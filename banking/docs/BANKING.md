# Banking Banking SDK

The Banking banking SDK lives in [../lib/banking](../lib/banking/) and is publicly exported through [../sdk/banking.ts](../sdk/banking.ts).

This layer is intended for app/server orchestration code. For example, PriceEdge can use it internally while exposing a single application-specific API to PriceEdgeShop.

## Providers

Banking currently ships these peer banking providers:

- `checkbook`
- `usio`
- `bridge`
- `unit`
- `swipelux`

Each one implements the shared `BankingProvider` interface defined in [../lib/banking/types.ts](../lib/banking/types.ts).

## Generic usage

```ts
import { Banking } from '@vowlabs/banking'

const banking = await Banking.create('bridge')
```

This gives an orchestrating app one place to switch between providers without changing the rest of its internal application code.

## Provider-specific classes

```ts
import {
  SwipeLuxProvider,
  CheckbookProvider,
  USIOProvider,
  BridgeProvider,
  UnitProvider
} from '@vowlabs/banking'
```

Use this shape when the application is intentionally tied to one provider.

## Shared concepts

- `User`: customer or business identity payload
- `EscrowAcct`: provider-managed funding / wallet account
- `ExitAcct`: external bank account or payout destination
- `Cheque`: normalized payout or transfer request

## Notes on compatibility

The shared interface is intentionally broad, so not every provider maps every method naturally.

- `checkbook` and `usio` are the most similar to the original generic model.
- `bridge` adapts Bridge’s customer and external-account model into the shared interface.
- `unit` supports the interface, but some methods intentionally throw unsupported errors where Unit’s workflow is application-based rather than mutable through the old generic shape.

## Environment

Provider-specific configuration:

- Checkbook: `CHKBK_URL`, `CHKBK_PUBLIC`, `CHKBK_SECRET`
- USIO: `USIO_API`, `USIO_KEY`, `USIO_SECRET`
- Bridge: `BRIDGE_API_URL`, `BRIDGE_API_KEY`
- Unit: `UNIT_API_URL`, `UNIT_TOKEN`, `UNIT_DEPOSIT_PRODUCT`

## SwipeLux

Select `swipelux` through `Banking`, or import `SwipeLuxProvider` for native v3 accounts, capabilities, quotes, and transfers. Set `SWIPELUX_API_KEY`; optional `SWIPELUX_API_URL` defaults to `https://platform.swipelux.com`. See [SwipeLux integration](SWIPELUX.md) for supported methods, retry keys, and account-opening examples.
