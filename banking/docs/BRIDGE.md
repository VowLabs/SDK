# Banking Bridge Provider

This document describes Banking’s Bridge banking provider.

Implementation:

- [../lib/banking/bridge.ts](../lib/banking/bridge.ts)

Public SDK entry:

- [../sdk/banking.ts](../sdk/banking.ts)

Tests:

- [../test/bridge.test.ts](../test/bridge.test.ts)

Environment example:

- [../.env.bridge.example](../.env.bridge.example)

## Overview

Bridge provides ACH-oriented fiat on-banking and off-banking capabilities.

Within Banking, the Bridge provider is one peer option alongside:

- `checkbook`
- `usio`
- `unit`

## Environment

```bash
BRIDGE_API_URL=https://api.bridge.xyz/v0
BRIDGE_API_KEY=your_api_key_here
```

For sandbox usage:

```bash
BRIDGE_API_URL=https://api.sandbox.bridge.xyz/v0
```

Get an API key from the [Bridge Dashboard](https://dashboard.bridge.xyz/app/keys). Bridge only shows newly generated keys once, so copy the key into a secure environment store immediately.

## Usage

```ts
import { Banking } from '@vowlabs/banking'

const banking = await Banking.create('bridge')
```

Typical onboarding shape:

```ts
const banking = await Banking.create('bridge')

const customerId = await banking.newUser({
  id: 'app-user-id',
  name: 'Ada Lovelace'
})

await banking.addExitAcct({
  type: 'CHECKING',
  routing: 121000248,
  account: 1234567890
})
```

## API mapping

| Shared method | Bridge API |
|---|---|
| `newUser()` | `POST /customers` |
| `getUser()` | `GET /customers/{id}` |
| `editUser()` | `PUT /customers/{id}` |
| `delUser()` | `DELETE /customers/{id}` |
| `addExitAcct()` | `POST /customers/{id}/external_accounts` |
| `getExitAcct()` | `GET /customers/{id}/external_accounts` |
| `getEscrowAcct()` | customer lookup adapted into escrow shape |
| `addEscrowAcct()` | customer lookup adapted into escrow shape |

`createCheque()` and `depositCheque()` are currently Banking-level adapters rather than full Bridge transfer orchestration.

## Unsupported methods

Bridge does not currently support:

- `addPaypal()`
- `addVenmo()`

## Notes

- The Bridge provider adapts Bridge’s model into the shared banking interface; it is not meant to be a full Bridge SDK.
- If clients need a more Bridge-native integration later, that should follow the same pattern as `UnitClient`: a provider-neutral wrapper plus a service-native client.

## Testing

Run the Bridge provider tests from the SDK package:

```bash
pnpm test test/bridge.test.ts
```

To test API connectivity manually:

```bash
curl -H "Api-Key: $BRIDGE_API_KEY" https://api.sandbox.bridge.xyz/v0/customers
```

## Production Checklist

- Use the production Bridge API URL only after sandbox flows are verified.
- Store `BRIDGE_API_KEY` in a secure environment store.
- Add rate limiting, retries, and structured error logging in the orchestrating app.
- Handle transfer status webhooks before enabling real on/off-banking flows.
- Document KYC requirements for the jurisdictions the app supports.

## Common Issues

- `401 Unauthorized`: check that the API key is correct, active, and loaded in the runtime environment.
- `422 Unprocessable Entity`: validate customer fields and bank account details before calling Bridge.
- Customer not ready to transact: inspect Bridge customer requirements and complete KYC steps.
- No external accounts: call `addExitAcct()` before flows that require a bank account.

## Bridge Links

- [Bridge API docs](https://apidocs.bridge.xyz/)
- [Bridge Dashboard](https://dashboard.bridge.xyz/)
- [Bridge Support](https://support.bridge.xyz/)
