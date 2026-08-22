# Banking Unit Integration

This document describes Banking’s Unit integration.

Banking provides the Unit-specific SDK pieces. An app such as PriceEdge is expected to own the surrounding process and can embed these Banking forms/widgets or call the Unit utilities from its own server code.

Relevant files:

- Shared provider: [../lib/banking/unit.ts](../lib/banking/unit.ts)
- Server-side Unit client: [../sdk/utils/unit-client.mjs](../sdk/utils/unit-client.mjs)
- React onboarding component: [../lib/unit-onboarding/UnitOnboarding.tsx](../lib/unit-onboarding/UnitOnboarding.tsx)
- Browser embeds: [../public/banking-sdk.js](../public/banking-sdk.js) and [../public/unit-onboarding.js](../public/unit-onboarding.js)

## Two ways to use Unit in Banking

### 1. Through the shared banking abstraction

```ts
import { Banking } from '@vowlabs/banking'

const banking = await Banking.create('unit')
```

Use this when you want Unit to behave as one interchangeable banking provider among several.

### 2. Through the Unit-native client

```js
import { UnitClient } from '@vowlabs/banking'
```

Use this when you want a more explicit Unit-native flow for:

- consumer account opening
- merchant funding account opening
- received-payment polling

## Environment variables

Required:

```text
UNIT_TOKEN=your-unit-org-api-token
```

Optional:

```text
UNIT_API_URL=https://api.s.unit.sh
UNIT_DEPOSIT_PRODUCT=checking
```

## Shared provider support

The shared provider currently implements:

- `newUser(user)`
- `getUser(auth?)`
- `addEscrowAcct()`
- `getEscrowAcct(auth?)`
- `addExitAcct(account)`
- `getExitAcct(auth?)`
- `createCheque(cheque)`

The following methods intentionally return unsupported errors:

- `editUser(...)`
- `delUser(...)`
- `addPaypal(...)`
- `addVenmo(...)`
- `depositCheque(...)`

## Unit client methods

`UnitClient` currently exposes:

- `isConfigured()`
- `assertConfigured()`
- `createConsumerFundingAccount(payload, forwardedIp?)`
- `createMerchantFundingAccount(payload, forwardedIp?)`
- `listCompletedReceivedPayments({ accountId, since }?)`

## Browser SDK-owned UI

```html
<script src="https://vowlabs.dev/sdk/banking.js"></script>
<div id="BankingUnitOnboarding"></div>
```

Or:

```js
window.VowLabs.Banking.mountUnitOnboarding('#BankingUnitOnboarding', {
  baseUrl: 'https://your-app.example/banking'
})
```

Banking also exposes the merchant/business Unit application form as a browser widget:

```js
window.VowLabs.Banking.mountMerchantUnitApplication('#MerchantBankingApplication', {
  context: { country: 'US' },
  onChange(payload, meta) {
    console.log(payload, meta.complete)
  }
})
```

## Why `UnitClient` exists

`UnitClient` exists because Unit’s native application/account flow is richer than the old generic provider abstraction.

The shared provider is useful for interchangeability.

The Unit client is useful when an app such as PriceEdge needs:

- explicit individual vs business onboarding
- direct control over Unit tags and idempotency keys
- direct access to Unit payment polling

## Sources

- Unit Applications: https://www.unit.co/docs/api/applications/
- Unit Deposit Accounts: https://www.unit.co/docs/api/accounts/deposit-accounts/apis/
- Unit ACH / Payments: https://www.unit.co/docs/api/payments/ach/originating/apis/
