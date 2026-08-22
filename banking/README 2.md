# Banking

Banking is VowLabs' off-chain banking and onboarding product. It owns provider integrations, normalized banking interfaces, and embeddable onboarding UI that other Vow applications can use from trusted server code or browser-safe widgets.

The Telegram customer bot lives separately in [../../../NokNok/Telegram](../../../NokNok/Telegram/). That app consumes this SDK; it is not the SDK itself.

## Repository Shape

- [lib/banking](lib/banking/) contains the internal provider implementations.
- [sdk](sdk/) is the public TypeScript SDK export surface.
- [sdk/utils](sdk/utils/) contains provider-native helpers that intentionally sit outside the shared banking abstraction.
- [lib/unit-onboarding](lib/unit-onboarding/) contains SDK-owned onboarding components.
- [public/banking-sdk.js](public/banking-sdk.js) and [public/unit-onboarding.js](public/unit-onboarding.js) are browser SDK assets.
- [../../../NokNok/Telegram](../../../NokNok/Telegram/) is the Next.js Telegram Mini App and bot webhook implementation.

## Where To Start

- SDK overview: [docs/SDK.md](docs/SDK.md)
- Banking providers: [docs/BANKING.md](docs/BANKING.md)
- Unit integration: [docs/UNIT.md](docs/UNIT.md)
- Bridge integration: [docs/BRIDGE.md](docs/BRIDGE.md)
- Telegram app and bot: [../../../NokNok/Telegram/README.md](../../../NokNok/Telegram/README.md)

## Public SDK Entry Points

- TypeScript SDK exports: [sdk/index.ts](sdk/index.ts)
- Banking SDK exports: [sdk/banking.ts](sdk/banking.ts)
- Provider-native utilities: [sdk/utils](sdk/utils/)
- Browser SDK widgets/forms: [public/banking-sdk.js](public/banking-sdk.js)

Banking is meant to be embedded by an orchestrating app such as PriceEdge or the Telegram bot. Those apps own user journeys, auth, routing, and product-specific policy.

## Banking Services

Banking currently supports these peer providers:

- `checkbook`
- `usio`
- `bridge`
- `unit`

Use the shared provider interface when an app wants interchangeable services behind one internal interface:

```ts
import { Banking } from '@vowlabs/banking'

const banking = await Banking.create('unit')
```

Use provider-native utilities when the orchestrating app needs service-specific behavior that does not fit the shared abstraction cleanly:

```js
import { UnitClient } from '@vowlabs/banking'

const unit = new UnitClient({
  unitApiUrl: process.env.UNIT_API_URL,
  unitToken: process.env.UNIT_TOKEN,
  unitDepositProduct: 'checking'
})
```

The first utility in that category is [sdk/utils/unit-client.mjs](sdk/utils/unit-client.mjs).

## Development

From this directory:

```bash
pnpm install
pnpm test
pnpm typecheck
```

The Telegram app is intentionally a separate package:

```bash
pnpm -C ../../../NokNok/Telegram dev
pnpm -C ../../../NokNok/Telegram dev:https
pnpm -C ../../../NokNok/Telegram build
pnpm -C ../../../NokNok/Telegram start
```

Those commands run the bot/Mini App on port 24105. SDK-focused tests live under [test](test/); Telegram-specific tests live under [../../../NokNok/Telegram/test](../../../NokNok/Telegram/test/).

## Environment

Provider configuration is read from environment variables by the individual provider implementations:

- Checkbook: `CHKBK_URL`, `CHKBK_PUBLIC`, `CHKBK_SECRET`
- USIO: `USIO_API`, `USIO_KEY`, `USIO_SECRET`
- Bridge: `BRIDGE_API_URL`, `BRIDGE_API_KEY`
- Unit: `UNIT_API_URL`, `UNIT_TOKEN`, `UNIT_DEPOSIT_PRODUCT`

Error codes use the dot-prefix format consumed by app translation layers, for example `.checkbook.user-get` and `.redis.user-not-found`. Preserve those codes when adding provider behavior.
