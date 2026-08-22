# Banking Docs

Banking owns the banking and onboarding SDK surface for this repo.

These docs describe Banking as a library layer used by apps such as PriceEdge. PriceEdgeShop or another frontend client should talk to its own application server, and that application server can use Banking internally.

Client-facing entry points:

- [SDK.md](SDK.md): overview of the Banking SDK for app/server integrators
- [BANKING.md](BANKING.md): shared banking interface and provider selection
- [UNIT.md](UNIT.md): Unit-specific account opening and onboarding details
- [BRIDGE.md](BRIDGE.md): Bridge provider usage and API mapping

Implementation entry points:

- Banking providers live in [../lib/banking](../lib/banking/)
- Public TypeScript SDK exports live in [../sdk](../sdk/)
- Browser widgets/forms live in [../public/banking-sdk.js](../public/banking-sdk.js) and [../public/unit-onboarding.js](../public/unit-onboarding.js)
