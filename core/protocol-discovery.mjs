const MCP_VERSION = "2025-06-18";
const UCP_VERSION = "2026-04-08";

function originFor(req, fallback) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || (fallback?.startsWith("https:") ? "https" : "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return host ? `${protocol}://${host}` : fallback;
}

function openApi(config, origin) {
  const paths = config.endpoints.reduce((paths, endpoint) => {
    const parameters = [...endpoint.path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => ({ name, in: "path", required: true, schema: { type: "string" } }));
    paths[endpoint.path] ||= {};
    paths[endpoint.path][endpoint.method.toLowerCase()] = {
      operationId: endpoint.operationId,
      summary: endpoint.description,
      tags: [endpoint.tag || "Commerce"],
      ...(parameters.length ? { parameters } : {}),
      responses: { "200": { description: "Successful response" }, "400": { description: "Invalid request" }, "401": { description: "Authentication required" }, "409": { description: "State conflict" } }
    };
    return paths;
  }, {});
  paths["/.well-known/ucp"] = { get: { operationId: "getUcpProfile", summary: "Get the UCP discovery profile", tags: ["Discovery"], responses: { "200": { description: "UCP profile" } } } };
  paths["/.well-known/agent-card.json"] = { get: { operationId: "getAgentCard", summary: "Get the A2A Agent Card", tags: ["Discovery"], responses: { "200": { description: "A2A Agent Card" } } } };
  paths["/mcp"] = { post: { operationId: "callMcp", summary: "Call the read-only MCP server over Streamable HTTP", tags: ["Discovery"], requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { "200": { description: "JSON-RPC response" } } } };
  return { openapi: "3.1.0", info: { title: `${config.name} API`, version: config.version || "1.0.0", description: config.description }, servers: [{ url: origin }], paths };
}

function ucpProfile(origin) {
  return {
    ucp: {
      version: UCP_VERSION,
      services: {
        "foundation.vow.discovery": [{
          version: UCP_VERSION,
          spec: `${origin}/llms.txt`,
          transport: "rest",
          schema: `${origin}/openapi.json`,
          endpoint: origin
        }]
      },
      capabilities: {},
      payment_handlers: {}
    }
  };
}

function agentCard(config, origin) {
  return {
    name: config.name,
    description: config.description,
    supportedInterfaces: [{ url: `${origin}/mcp`, protocolBinding: "https://modelcontextprotocol.io/specification/2025-06-18", protocolVersion: MCP_VERSION }],
    provider: { organization: "Vow", url: "https://vow.foundation" },
    version: config.version || "1.0.0",
    documentationUrl: `${origin}/llms.txt`,
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: [{ id: "public-api-discovery", name: "Public API discovery", description: `Explains ${config.name} and its public, read-only API operations.`, tags: ["discovery", "documentation", "api"], examples: ["List the public API operations"] }]
  };
}

function tools(config) {
  return [
    { name: "get_service_info", description: `Get a description and safety guidance for ${config.name}.`, inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "list_public_endpoints", description: `List documented public HTTP endpoints exposed by ${config.name}.`, inputSchema: { type: "object", properties: {}, additionalProperties: false } }
  ];
}

function mcpResponse(config, request) {
  const id = request?.id ?? null;
  if (request?.jsonrpc !== "2.0" || typeof request?.method !== "string") return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } };
  if (request.method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: MCP_VERSION, capabilities: { tools: {} }, serverInfo: { name: config.slug, version: config.version || "1.0.0" } } };
  if (request.method === "notifications/initialized") return null;
  if (request.method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (request.method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: tools(config) } };
  if (request.method === "tools/call") {
    const name = request.params?.name;
    let value;
    if (name === "get_service_info") value = { name: config.name, description: config.description, safety: config.safety };
    else if (name === "list_public_endpoints") value = { endpoints: config.endpoints };
    else return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${String(name || "")}` } };
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value } };
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1024 * 1024) throw new Error("Request body too large");
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(res, status, value, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", ...extra });
  res.end(value === null ? "" : JSON.stringify(value));
}

export async function handleProtocolDiscovery(req, res, url, config) {
  const origin = originFor(req, config.origin);
  if (req.method === "GET" && url.pathname === "/.well-known/ucp") {
    sendJson(res, 200, ucpProfile(origin), { "cache-control": "public, max-age=300" });
    return true;
  }
  if (req.method === "GET" && url.pathname === "/.well-known/agent-card.json") {
    sendJson(res, 200, agentCard(config, origin), { "cache-control": "public, max-age=300", etag: `W/\"${config.slug}-${config.version || "1.0.0"}\"` });
    return true;
  }
  if (req.method === "GET" && url.pathname === "/openapi.json") {
    sendJson(res, 200, openApi(config, origin), { "cache-control": "public, max-age=300" });
    return true;
  }
  if (url.pathname === "/mcp" && req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type,mcp-protocol-version" });
    res.end();
    return true;
  }
  if (url.pathname === "/mcp" && req.method === "POST") {
    try {
      const request = await readBody(req);
      const response = Array.isArray(request) ? request.map(item => mcpResponse(config, item)).filter(Boolean) : mcpResponse(config, request);
      if (response === null || (Array.isArray(response) && response.length === 0)) { res.writeHead(202); res.end(); }
      else sendJson(res, 200, response, { "cache-control": "no-store" });
    } catch (error) {
      sendJson(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: error instanceof Error ? error.message : "Parse error" } });
    }
    return true;
  }
  return false;
}
