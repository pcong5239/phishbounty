# PhishBounty frontend

## Local development

```sh
npm install
npm run dev
```

## Running tests

```sh
npm test
```

Runs 13 regression tests: 11 for fail-closed transaction execution result handling and two
for the wallet-signed brand onboarding call sequence and input bounds.

## Production build

```sh
npm run build
```

Studionet contract addresses are defined in `src/config/contracts.ts`. They are
the current smoke-verified Studionet development deployment and must be replaced only
after a later contract release has been deployed and its new addresses have been verified.

The Brands page exposes `register_brand` through the same wallet and finalized-execution gate
used by funding, bounty configuration, and report submission. After registration finalizes, the
on-chain brand list refreshes so its admin can open the new brand and fund its pool.

Routes under `/fixtures/*` are controlled adjudication test fixtures. The
impersonation fixture targets the fictional “Example Brand”; `example.com` is an
IANA-reserved documentation domain. Its credential form is inert, submits
nothing, and collects or stores no data. Fixture responses are marked `noindex`
by the Vercel configuration.
