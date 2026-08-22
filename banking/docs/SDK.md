# Banking SDK

This document is the main integration guide for apps using Banking as an SDK.

Banking is a library layer, not the outer application boundary. In this repo, PriceEdge is the orchestrating app and PriceEdgeShop is the ultimate client. The expected pattern is:

- the client talks to PriceEdge
- PriceEdge owns the end-to-end process
- PriceEdge uses Banking internally for banking abstractions, provider-native utilities, and onboarding forms/widgets

## What the SDK includes

Banking exposes two related SDK surfaces:

- A TypeScript/server SDK under [../sdk](../sdk/)
- A browser embed SDK under [../public/banking-sdk.js](../public/banking-sdk.js)

The current public capabilities are:

- Banking provider selection through a shared `Banking` interface
- Provider-specific access to `checkbook`, `usio`, `bridge`, and `unit`
- A Unit API client for server-side funding-account creation
- SDK-owned browser forms/widgets for Banking-related onboarding

## TypeScript SDK

Primary entry point:

- [../sdk/index.ts](../sdk/index.ts)

Banking entry point:

- [../sdk/banking.ts](../sdk/banking.ts)

### Available banking services

```ts
import { AVAILABLE_BANKING_SERVICES } from '@vowlabs/banking'

console.log(AVAILABLE_BANKING_SERVICES)
// ['checkbook', 'usio', 'bridge', 'unit']
```

### Generic provider selection

```ts
import { Banking } from '@vowlabs/banking'

const banking = await Banking.create('unit')
```

Supported service names:

- `checkbook`
- `usio`
- `bridge`
- `unit`

### Provider-specific imports

```ts
import {
  CheckbookProvider,
  USIOProvider,
  BridgeProvider,
  UnitProvider
} from '@vowlabs/banking'
```

Use provider-specific classes when you want direct access to a single service rather than the shared abstraction.

### Shared banking interface

The shared banking interface includes:

- `newUser(...)`
- `getUser(...)`
- `editUser(...)`
- `delUser(...)`
- `addEscrowAcct()`
- `getEscrowAcct(...)`
- `addExitAcct(...)`
- `getExitAcct(...)`
- `createCheque(...)`
- `depositCheque(...)`

Type definitions live in [../lib/banking/types.ts](../lib/banking/types.ts).

## Provider-native utilities

Provider-native utilities live under [../sdk/utils](../sdk/utils/).

These are the right place for service-specific helpers that do not fit the generic multi-provider abstraction cleanly.

## Server-side Unit client

The file [../sdk/utils/unit-client.mjs](../sdk/utils/unit-client.mjs) is a server-side helper for talking directly to Unit's REST API.

It is not the generic banking abstraction.

It exists for flows where an app server such as PriceEdge wants a more Unit-native interface than `Banking.create('unit')`, especially:

- consumer funding account creation
- merchant funding account creation
- reading completed inbound payments from Unit

Example:

```js
import { UnitClient } from '@vowlabs/banking'

const unit = new UnitClient({
  unitApiUrl: process.env.UNIT_API_URL,
  unitToken: process.env.UNIT_TOKEN,
  unitDepositProduct: 'checking'
})

const account = await unit.createConsumerFundingAccount({
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  dob: '1815-12-10',
  ssn: '123456789',
  street: '12 St James Sq',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  country: 'US'
})
```

Why it exists:

- The generic `Banking` abstraction normalizes several providers behind one API.
- `UnitClient` keeps a more explicit Unit-native flow for onboarding and payment polling.
- PriceEdge currently uses this client directly on the server.
- More provider-native utilities can be added beside it under `Banking/sdk/utils`.

## Browser SDK

Browser entry point:

- [../public/banking-sdk.js](../public/banking-sdk.js)

Current browser APIs:

- `window.VowLabs.Banking.mountUnitOnboarding(...)`
- `window.VowLabs.Banking.mountMerchantUnitApplication(...)`
- `window.VowLabs.Banking.openMerchantFundingAccount(...)`

These browser APIs are for SDK-owned Banking UI that an app embeds inside its own experience. They are not a replacement for the app's own backend orchestration.

### Embedding Unit onboarding UI

```html
<script src="https://vowlabs.dev/sdk/banking.js"></script>
<div id="onboarding"></div>
<script>
  window.VowLabs.Banking.mountUnitOnboarding('#onboarding', {
    baseUrl: 'https://your-app.example/banking',
    walletAddress: '0xabc...',
    walletChainId: 1,
    onComplete(account) {
      console.log('created account', account)
    }
  })
</script>
```

### Embedding the merchant Unit application form

```html
<script src="https://vowlabs.dev/sdk/banking.js"></script>
<div id="merchantBankingForm"></div>
<script>
  const widget = window.VowLabs.Banking.mountMerchantUnitApplication('#merchantBankingForm', {
    context: { country: 'US' },
    onChange(payload, meta) {
      console.log('merchant unit payload', payload)
      console.log('form completeness', meta.complete)
    }
  })
</script>
```

### Merchant funding-account opening

```html
<script src="https://vowlabs.dev/sdk/banking.js"></script>
<script>
  const result = await window.VowLabs.Banking.openMerchantFundingAccount({
    endpoint: '/api/merchant/onboarding',
    apiKey: 'merchant-api-key',
    payload: {
      business_name: 'Example Inc',
      contact_name: 'Ada Lovelace',
      contact_email: 'ada@example.com'
    }
  })
</script>
```

## Recommended integration split

- Let the ultimate client call your application, not Banking directly.
- Use the TypeScript SDK from trusted app/server code.
- Use the browser SDK only for embedded Banking-owned onboarding UI and browser-safe helpers.
- Use `Banking.create(service)` when you want provider interchangeability.
- Use `UnitClient` when you need Unit-specific onboarding or payment behavior.
