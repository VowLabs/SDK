# VowLabs SDK

The VowLabs SDK repository contains reusable modules, provider integrations,
and browser assets intended to be consumed by Vow applications and open-source
integrations.

## Packages

- `core/` — protocol discovery and shared HTTP capability descriptions.
- `banking/` — provider-neutral banking APIs, provider integrations, onboarding
  components, and browser bundles. See its [README](banking/README.md).

These modules are deliberately separate from `VowLabs/Offchain`, which hosts
deployable services and workers.
