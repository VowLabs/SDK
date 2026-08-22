import crypto from "node:crypto";

const JSON_API_CONTENT_TYPE = "application/vnd.api+json";

export class UnitClient {
  constructor(config = {}) {
    this.apiUrl = String(config.unitApiUrl ?? "").replace(/\/+$/, "");
    this.token = String(config.unitToken ?? "");
    this.depositProduct = String(config.unitDepositProduct ?? "checking");
    this.debug = Boolean(config.unitDebug);
    this.sourceTag = String(config.unitSourceTag ?? "banking");
    this.merchantSourceTag = String(config.unitMerchantSourceTag ?? `${this.sourceTag}-merchant`);
  }

  isConfigured() {
    return Boolean(this.apiUrl && this.token);
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error("Banking Unit onboarding is not configured.");
    }
  }

  async createConsumerFundingAccount(payload, forwardedIp = "") {
    this.assertConfigured();
    const [firstName, ...rest] = String(payload.first_name ?? "").trim().split(/\s+/);
    const lastName = String(payload.last_name ?? "").trim() || rest.join(" ") || "Member";
    const country = normalizeCountry(payload.country);
    const phone = normalizePhone(payload.phone, payload.country);
    const ssn = normalizeSsn(payload.ssn, country);

    const application = await this.request("/applications", {
      method: "POST",
      body: {
        data: {
          type: "individualApplication",
          attributes: {
            ssn,
            fullName: {
              first: firstName || "Banking",
              last: lastName
            },
            dateOfBirth: String(payload.dob ?? "").trim(),
            address: {
              street: String(payload.street ?? "").trim(),
              city: String(payload.city ?? "").trim(),
              state: String(payload.state ?? "").trim(),
              postalCode: String(payload.zip ?? "").trim(),
              country
            },
            email: String(payload.email ?? "").trim(),
            occupation: String(payload.occupation ?? "").trim(),
            ...(phone ? { phone } : {}),
            ...(forwardedIp ? { ip: forwardedIp } : {}),
            tags: {
              source: this.sourceTag,
              wallet: String(payload.wallet_address ?? "").trim()
            },
            idempotencyKey: `${this.sourceTag}-${crypto.randomUUID()}`
          }
        }
      }
    });

    const applicationStatus = String(application?.attributes?.status ?? "").trim();
    const applicationMessage = unitApplicationMessage(applicationStatus);
    if (applicationMessage) {
      throw new Error(applicationMessage);
    }

    const customerId =
      application?.relationships?.customer?.data?.id ||
      application?.relationships?.customers?.data?.[0]?.id ||
      "";
    const ownerId = customerId || application?.id;
    if (!ownerId) {
      throw new Error("Unit did not return a customer or application id.");
    }

    const account = await this.request("/accounts", {
      method: "POST",
      body: {
        data: {
          type: "depositAccount",
          attributes: {
            depositProduct: this.depositProduct,
            tags: {
              source: this.sourceTag,
              wallet: String(payload.wallet_address ?? "").trim()
            }
          },
          relationships: {
            customer: {
              data: {
                type: "customer",
                id: ownerId
              }
            }
          }
        }
      }
    });

    return normalizeAccount(account, customerId);
  }

  async createMerchantFundingAccount(payload, forwardedIp = "") {
    this.assertConfigured();
    const country = normalizeCountry(payload.country);
    const phone = normalizePhone(payload.phone, country);
    const contactName = String(payload.contact_name ?? payload.contactName ?? "").trim();
    const [contactFirstName, ...contactRest] = contactName.split(/\s+/).filter(Boolean);
    const contactLastName = contactRest.join(" ") || contactFirstName || "Merchant";
    const entityType = String(payload.entity_type ?? payload.entityType ?? "LLC").trim();
    const stateOfIncorporation = String(
      payload.state_of_incorporation ?? payload.stateOfIncorporation ?? payload.state ?? ""
    ).trim();
    const yearOfIncorporation = String(
      payload.year_of_incorporation ?? payload.yearOfIncorporation ?? ""
    ).trim();

    const application = await this.request("/applications", {
      method: "POST",
      body: {
        data: {
          type: "businessApplication",
          attributes: {
            name: String(payload.business_name ?? payload["business-name"] ?? "").trim(),
            address: {
              street: String(payload.street ?? "").trim(),
              city: String(payload.city ?? "").trim(),
              state: String(payload.state ?? "").trim(),
              postalCode: String(payload.zip ?? "").trim(),
              country
            },
            ...(phone ? { phone } : {}),
            stateOfIncorporation,
            ...(yearOfIncorporation ? { yearOfIncorporation } : {}),
            ein: normalizeEin(payload.ein),
            entityType,
            website: String(payload.website ?? "").trim() || null,
            contact: {
              fullName: {
                first: contactFirstName || "Banking",
                last: contactLastName
              },
              email: String(payload.contact_email ?? payload.email ?? "").trim(),
              ...(phone ? { phone } : {})
            },
            officer: {
              fullName: {
                first: contactFirstName || "Banking",
                last: contactLastName
              },
              title: String(payload.officer_title ?? payload.officerTitle ?? "Member").trim(),
              ssn: normalizeSsn(payload.ssn, country),
              dateOfBirth: String(payload.dob ?? "").trim(),
              address: {
                street: String(payload.street ?? "").trim(),
                city: String(payload.city ?? "").trim(),
                state: String(payload.state ?? "").trim(),
                postalCode: String(payload.zip ?? "").trim(),
                country
              },
              email: String(payload.contact_email ?? payload.email ?? "").trim(),
              ...(phone ? { phone } : {})
            },
            beneficialOwners: Array.isArray(payload.beneficial_owners) ? payload.beneficial_owners : [],
            ...(forwardedIp ? { ip: forwardedIp } : {}),
            tags: {
              source: this.merchantSourceTag,
              wallet: String(payload.settlement_address ?? payload.wallet_address ?? "").trim(),
              businessName: String(payload.business_name ?? payload["business-name"] ?? "").trim()
            },
            idempotencyKey: `${this.merchantSourceTag}-${crypto.randomUUID()}`
          }
        }
      }
    });

    const applicationStatus = String(application?.attributes?.status ?? "").trim();
    const applicationMessage = unitApplicationMessage(applicationStatus);
    if (applicationMessage) {
      throw new Error(applicationMessage);
    }

    const customerId =
      application?.relationships?.customer?.data?.id ||
      application?.relationships?.customers?.data?.[0]?.id ||
      "";
    const ownerId = customerId || application?.id;
    if (!ownerId) {
      throw new Error("Unit did not return a customer or application id for merchant onboarding.");
    }

    const account = await this.request("/accounts", {
      method: "POST",
      body: {
        data: {
          type: "depositAccount",
          attributes: {
            depositProduct: this.depositProduct,
            tags: {
              source: this.merchantSourceTag,
              wallet: String(payload.settlement_address ?? payload.wallet_address ?? "").trim(),
              businessName: String(payload.business_name ?? payload["business-name"] ?? "").trim()
            }
          },
          relationships: {
            customer: {
              data: {
                type: "customer",
                id: ownerId
              }
            }
          }
        }
      }
    });

    return {
      applicationId: application?.id ?? "",
      applicationStatus,
      ...normalizeAccount(account, customerId)
    };
  }

  async listCompletedReceivedPayments({ accountId, since } = {}) {
    this.assertConfigured();
    const query = new URLSearchParams();
    query.set("filter[includeCompleted]", "true");
    query.set("filter[type]", "Ach");
    if (accountId) {
      query.set("filter[accountId]", String(accountId));
    }
    if (since) {
      query.set("filter[since]", String(since));
    }

    const payload = await this.request(`/received-payments?${query.toString()}`, {
      method: "GET"
    });
    return Array.isArray(payload) ? payload : [];
  }

  async request(resourcePath, options = {}) {
    const method = options.method ?? "GET";
    const url = `${this.apiUrl}${resourcePath}`;
    const requestBody = options.body ? JSON.stringify(options.body) : undefined;
    const logMeta = {
      method,
      url,
      body: sanitizeForLog(options.body)
    };

    this.log("log", `[Banking][Unit] request ${method} ${resourcePath}`, logMeta);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": JSON_API_CONTENT_TYPE
        },
        body: requestBody
      });

      const payload = await response.json().catch(() => null);
      this.log("log", `[Banking][Unit] response ${method} ${resourcePath} status=${response.status}`, {
        method,
        url,
        status: response.status,
        ok: response.ok,
        body: sanitizeForLog(payload)
      });

      if (!response.ok) {
        const message =
          payload?.errors?.map((entry) => entry?.detail || entry?.title).filter(Boolean).join("; ") ||
          payload?.error ||
          `Unit request failed with status ${response.status}`;
        throw new Error(message);
      }

      return payload?.data ?? payload;
    } catch (error) {
      this.log("error", `[Banking][Unit] failure ${method} ${resourcePath}`, {
        ...logMeta,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  log(level, message, meta) {
    if (!this.debug) return;
    console[level](message, meta);
  }
}

function unitApplicationMessage(status) {
  switch (String(status || "").toLowerCase()) {
    case "denied":
      return "We were unable to verify your identity at this time. Please contact support if you have questions.";
    case "pending":
      return "Your application is being reviewed. Please check back shortly.";
    case "pendingreview":
      return "Your application is under review. Please check back shortly.";
    case "awaitingdocuments":
      return "We need additional documents to continue your account opening. Please contact support for the next steps.";
    case "canceled":
    case "cancelled":
      return "Your application was canceled. Please try again or contact support if you need help.";
    default:
      return "";
  }
}

function normalizeAccount(account, customerId = "") {
  const attrs = account?.attributes ?? {};
  return {
    id: account?.id ?? "",
    customer_id: customerId,
    balance: Number(attrs.balance || 0) / 100,
    created_at: attrs.createdAt || new Date().toISOString(),
    name: attrs.name || "Unit Deposit Account",
    ach: {
      account_number: attrs.accountNumber || "",
      routing_number: attrs.routingNumber || ""
    },
    rtp: {
      account_number: attrs.accountNumber || "",
      routing_number: attrs.routingNumber || ""
    },
    wire: {
      account_number: attrs.accountNumber || "",
      routing_number: attrs.routingNumber || ""
    }
  };
}

function normalizeCountry(country) {
  const normalized = String(country ?? "US").trim().toUpperCase();
  return normalized || "US";
}

function normalizePhone(value, country = "US") {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (String(country).trim().toUpperCase() === "US") {
    const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    return {
      countryCode: "1",
      number: national
    };
  }
  return {
    countryCode: "",
    number: digits
  };
}

function normalizeSsn(value, country = "US") {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (String(country).trim().toUpperCase() === "US") {
    return digits.slice(0, 9);
  }
  return digits;
}

function normalizeEin(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 9);
}

function sanitizeForLog(value) {
  if (!value || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value, (key, currentValue) => {
    const lowerKey = String(key || "").toLowerCase();
    if (["ssn", "ein", "accountnumber", "routingnumber", "token"].includes(lowerKey)) {
      return "[redacted]";
    }
    return currentValue;
  }));
}
