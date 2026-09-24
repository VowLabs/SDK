# Banking SDK

`@vowlabs/banking` is VowLabs’ reusable banking and onboarding library. It provides provider adapters, a typed server SDK, provider-native utilities, and browser onboarding assets. It is not an application boundary: consuming applications own identity, authentication, authorization, routing, customer support, and product policy.

Use Banking from a trusted application server. Browser widgets must call that application’s backend; never expose provider credentials in browser code.

## Contents

- [sdk/index.ts](sdk/index.ts): package exports.
- [sdk/banking.ts](sdk/banking.ts): `Banking`, provider classes, shared types, and account-opening field helpers.
- [sdk/utils](sdk/utils/): provider-native utilities, including `UnitClient`.
- [sdk/burn.ts](sdk/burn.ts), [sdk/staking.ts](sdk/staking.ts), and [sdk/watch.ts](sdk/watch.ts): optional chain-processing helpers.
- [lib/banking](lib/banking/): adapters for Checkbook, USIO, Bridge, Unit, and SwipeLux.
- [lib/unit-onboarding](lib/unit-onboarding/): SDK-owned React onboarding UI.
- [public/banking-sdk.js](public/banking-sdk.js) and [public/unit-onboarding.js](public/unit-onboarding.js): browser-ready assets.

## Development

```sh
pnpm install
pnpm test
pnpm typecheck
```

Before publishing, run `npm publish --access public`. Its publish lifecycle runs
the dependency audit, tests, typecheck, build, and package dry-run first; a
failed check prevents publication.

## Server SDK

```ts
import { Banking, UnitClient } from '@vowlabs/banking'

const banking = await Banking.create('unit')
const unit = new UnitClient({
  unitApiUrl: process.env.UNIT_API_URL,
  unitToken: process.env.UNIT_TOKEN,
  unitDepositProduct: 'checking'
})
```

Supported provider names are `checkbook`, `usio`, `bridge`, `unit`, and `swipelux`. The common interface covers user lifecycle, escrow accounts, exit accounts, and cheque operations. Use a provider class or provider-native utility when a flow does not fit that shared interface.

See [docs/SDK.md](docs/SDK.md), [docs/BANKING.md](docs/BANKING.md), [docs/UNIT.md](docs/UNIT.md), and [docs/BRIDGE.md](docs/BRIDGE.md) for supported operations and integration examples.

## Browser assets

`public/banking-sdk.js` exposes widgets through `window.VowLabs.Banking`. Use it for presentation only and route sensitive operations through the application-controlled backend specified by the widget’s `baseUrl`. Browser APIs and examples are documented in [docs/SDK.md](docs/SDK.md#browser-sdk).

## Configuration and security

Provider configuration is server-side environment only:

- Checkbook: `CHKBK_URL`, `CHKBK_PUBLIC`, `CHKBK_SECRET`
- USIO: `USIO_API`, `USIO_KEY`, `USIO_SECRET`
- Bridge: `BRIDGE_API_URL`, `BRIDGE_API_KEY`
- Unit: `UNIT_API_URL`, `UNIT_TOKEN`, `UNIT_DEPOSIT_PRODUCT`

Keep provider secrets in a secret manager and rotate them on exposure. Preserve dot-prefix error codes such as `.checkbook.user-get`, because consuming applications may map them to user-facing recovery behavior.

## SwipeLux

Select `swipelux` through `Banking`, or import `SwipeLuxProvider` for native v3 accounts, capabilities, quotes, and transfers. Set `SWIPELUX_API_KEY`; optional `SWIPELUX_API_URL` defaults to `https://platform.swipelux.com`. See [SwipeLux integration](docs/SWIPELUX.md) for supported methods, retry keys, and account-opening examples.
