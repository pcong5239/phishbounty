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

Runs 11 regression tests for fail-closed transaction execution result handling.

## Production build

```sh
npm run build
```

Studionet contract addresses are defined in `src/config/contracts.ts`. They are
the current smoke-verified Studionet development deployment and must be replaced only
after a later contract release has been deployed and its new addresses have been verified.

Routes under `/fixtures/*` are controlled adjudication test fixtures. The
impersonation fixture targets the fictional “Example Brand”; `example.com` is an
IANA-reserved documentation domain. Its credential form is inert, submits
nothing, and collects or stores no data. Fixture responses are marked `noindex`
by the Vercel configuration.
