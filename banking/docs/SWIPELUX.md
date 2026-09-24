# SwipeLux provider

SwipeLux is a peer provider selected with `Banking.create('swipelux')` and exported as `SwipeLuxProvider` from both `@vowlabs/banking` and `@vowlabs/banking/banking`. This integration targets the [SwipeLux v3 API](https://docs.swipelux.com/api-reference/introduction), checked against its [OpenAPI specification](https://docs.swipelux.com/openapi.json).

## Configuration

Set `SWIPELUX_API_KEY` in the consuming server's environment. `SWIPELUX_API_URL` optionally overrides the HTTPS origin (default `https://platform.swipelux.com`, without `/v3`). Sandbox and live use separate keys on the same host. Constructor options override environment configuration. Keep credentials on the server.

```ts
import { Banking, SwipeLuxProvider } from '@vowlabs/banking'

const banking = await Banking.create('swipelux')
const customerId = await banking.newUser({
  id: 'your-stable-customer-id',
  name: 'Amina Diallo',
  email: 'amina@example.com'
})

// Persist customerId in your application's customer record.
// Recreate a provider per customer context on later requests.
const swipelux = new SwipeLuxProvider({ customerId })
const customer = await swipelux.getUser()
```

`newUser` maps `User.id` to `externalId`, splits `name` into first/last name, and forwards supplied contact, address, birth date, and US tax identifiers. Supplying `business_name` creates a business with that legal name instead. Business contacts/owners, including their birth dates and SSNs, belong in SwipeLux related-party workflows and are not inferred from the shared `User`. Use `createCustomer` for explicit native profiles and names. Readiness comes from capabilities/tasks, not customer creation.

## Supported methods

| Surface | Methods | Behavior |
| --- | --- | --- |
| Shared customer lifecycle | `newUser`, `getUser`, `editUser`, `delUser` | Create/read customers, update individual birth date, archive customer. `getUser` uses the instance's `userId`; per-user `Auth` is rejected. |
| Native customer creation | `createCustomer` | Accept individual/business profiles and a persisted write key; returns the full customer and selects its ID. |
| Onboarding | `getSupportedCapabilities`, `listCapabilities`, `requestCapability`, `getTask`, `submitTask` | Discover availability and fulfill returned tasks using their current revision and submission schema. |
| Accounts | `createAccount`, `getAccount`, `listAccounts` | Issued/external wallets and bank accounts; list returns `data`, `nextCursor`, and `hasMore`. |
| Money movement | `createQuote`, `getQuote`, `createTransfer`, `getTransfer`, `getTransferInstructions` | Explicit quote/execute/read flow; amounts stay decimal strings. |
| Legacy escrow/exit accounts | `getEscrowAcct`, `addEscrowAcct`, `getExitAcct`, `addExitAcct` | Throw `.swipelux.*-not-supported`; use native account methods. |
| Legacy cheques/social payouts | `createCheque`, `depositCheque`, `addPaypal`, `addVenmo` | Throw `.swipelux.*-not-supported`; no simulated success. |

The shared escrow type requires a numeric balance and ACH/RTP/WIRE coordinates together. Shared exit accounts use numeric identifiers and omit currency/ownership details. Those shapes cannot safely represent SwipeLux accounts. Native methods preserve bank identifiers as strings, pending account details as `null`, task IDs, status, and decimal balances. Account creation is not proof of readiness.

## Accounts and transfers

Discover supported capabilities, request the needed capability, and complete its open tasks first. Choose currencies, networks and methods from the current customer's availability. The illustrative values below are not availability guarantees.

```ts
// Generate and persist each write key BEFORE sending its operation.
// Reuse that key and the identical payload to recover an uncertain response.
const wallet = await swipelux.createAccount({
  origin: 'issued', type: 'wallet', currency: 'USDC', network: 'base'
}, { idempotencyKey: 'stored-wallet-operation-id' })

const bank = await swipelux.createAccount({
  origin: 'issued', type: 'bank', currency: 'USD', country: 'US', method: 'ach',
  settlement: { accountId: wallet.id }
}, { idempotencyKey: 'stored-bank-operation-id' })

const current = await swipelux.getAccount(bank.id)
// Only display returned bank details when ready. Preserve any required reference.
```

For a payout, register the customer's external bank account with `createAccount`, passing string bank details, currency, country and methods. Third-party recipients/destinations must be provisioned through SwipeLux's recipient API; this adapter does not wrap that API. Pass the returned destination ID to `createQuote`.

```ts
const quote = await swipelux.createQuote({
  capabilityId: 'ach_pooled',
  in: { amount: '100.00', currency: 'USDC', accountId: 'acc_SOURCE_FROM_API' },
  destinationId: 'acc_DESTINATION_FROM_API',
  out: { currency: 'USD' }
}, { idempotencyKey: 'stored-quote-operation-id' })

// Inspect the current quote, expiry, fees, capability and account readiness,
// and available source balance before explicitly authorizing execution.
const transfer = await swipelux.createTransfer({ quoteId: quote.id }, {
  idempotencyKey: 'stored-transfer-operation-id'
})
const latest = await swipelux.getTransfer(transfer.id)
// Use latest.state and openTaskIds; creation does not imply settlement.
```

The adapter does not auto-execute quotes, retry writes, or interpret a checkout redirect as payment completion. Follow [SwipeLux's quote/transfer workflow](https://docs.swipelux.com/integration/quotes-and-transfers). Consuming servers own authorization, persistent operation records, task/document orchestration, and [verified webhooks](https://docs.swipelux.com/integration/webhooks). Polling `getTransfer` can also retrieve current state; no webhook receiver is installed by this SDK.

## Errors and retries

Native writes require `{ idempotencyKey }`. Shared `newUser` derives a stable key from the mapped request body; pass an explicit key through `SwipeLuxProvider.newUser` when managing operations yourself. This is bounded by SwipeLux's replay retention, not permanent customer deduplication; persist the returned customer ID. `editUser` and `delUser` accept explicit write options on the provider; otherwise they generate a fresh key. For safe retries of those operations, use the provider with persisted options, rather than repeatedly calling the legacy facade.

`SwipeLuxError.message` uses `.swipelux.<operation>`, `cause` preserves the API problem, and `idempotencyKey` records the failed write's key. Axios request configuration and credentials are not retained. For `quote_already_executed`, recover using the provider's returned `transferId`. Do not generate a new execution key for an uncertain transfer.

Provider configuration failures now propagate from the `Banking` constructor and reject `Banking.create`, for all providers, instead of being logged and swallowed.

## Onboarding fields

`getBankAccountOpeningFields('swipelux')` describes initial business creation. Pass `{ accountType: 'individual' }` for an individual. The schema collects initial profile fields only; it does not claim KYC/KYB or account opening is complete. `User.id` is supplied by the consuming backend. Additional requirements come from capability tasks.

## Local validation and adoption

From the workspace root:

```sh
pnpm -C VowLabs/SDK/banking test
pnpm -C VowLabs/SDK/banking typecheck
pnpm -C VowLabs/SDK/banking build
```

Tests mock HTTP at the adapter boundary; no live funds or credentials are used. To adopt, configure the consuming server's SwipeLux key and select this provider in that server. Existing applications keep their current provider until explicitly configured otherwise.
