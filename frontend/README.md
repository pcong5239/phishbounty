# PhishBounty frontend

## Local development

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build
```

Studionet contract addresses are defined in `src/config/contracts.ts`. They are
development addresses and will be replaced with release addresses in Phase 7.

Routes under `/fixtures/*` are controlled adjudication test fixtures. The
impersonation fixture targets the fictional “Example Brand”; `example.com` is an
IANA-reserved documentation domain. Its credential form is inert, submits
nothing, and collects or stores no data. Fixture responses are marked `noindex`
by the Vercel configuration.
