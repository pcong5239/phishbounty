# PhishBounty

PhishBounty is a brand-impersonation bounty protocol on GenLayer. A brand registers its
official domains and funds a bounty pool. A hunter stakes GEN to report a URL they believe
impersonates that brand. The Intelligent Contract then renders **both** the suspect page and
the official brand page inside consensus, and validators independently judge whether the
suspect page is impersonating. A confirmed report pays the hunter from the brand's pool and
appends the domain to an on-chain blocklist other contracts can query; a cleared report
forfeits the hunter's stake to the pool.

- **Live application:** https://phishbounty.vercel.app
- **Network:** GenLayer Studionet (chain ID `61999`, RPC `https://studio.genlayer.com/api`)

## Status

Development deployment on Studionet, wired to the live frontend. Studionet is a hosted
development network, not a production network.

Verified end-to-end on-chain so far: brand registration, pool funding, bounty configuration,
report submission from a second wallet, non-deterministic adjudication reaching consensus,
and settlement of a **cleared** report including stake slashing and pool accounting. The
confirmed-verdict payout path, appeals, and re-verification are implemented and unit-tested
but are still being exercised on-chain; this section is updated only against transactions that
have actually finalized.

## Deployed contracts (Studionet)

| Contract | Address |
| --- | --- |
| BrandRegistry | [`0xe34C583C04ccfa33C44A69010a02EB1A85071EF2`](https://explorer-studio.genlayer.com/address/0xe34C583C04ccfa33C44A69010a02EB1A85071EF2) |
| BlocklistLog | [`0x8a50d35df4Fb0599d6613aa35286BcE56a46F05A`](https://explorer-studio.genlayer.com/address/0x8a50d35df4Fb0599d6613aa35286BcE56a46F05A) |
| PhishReportCore | [`0x584890C0C49EA8dA61316b5512559063c0DE9c14`](https://explorer-studio.genlayer.com/address/0x584890C0C49EA8dA61316b5512559063c0DE9c14) |

Reference adjudication transaction (report #1, verdict `CLEARED`, finalized with a leader
rotation after validators rejected the first leader's proposal):
[`0xc72aac9f0ebb5dc95d54b3ceb9588eb0ae722233805a4763718e7ca86f8763e4`](https://explorer-studio.genlayer.com/tx/0xc72aac9f0ebb5dc95d54b3ceb9588eb0ae722233805a4763718e7ca86f8763e4)

## The trust problem

Declaring "this website is impersonating that brand" has real consequences — bounty money, a
hunter's forfeited stake, and a domain's public reputation — and no single party should hold
that decision. A brand deciding alone can suppress competitors and critics. A hunter deciding
alone can farm bounties with false reports. A centralized anti-phishing service is one
operator whose evidence gathering, model, and verdict nobody can verify.

## Why GenLayer is required

The evidence lives only on the open web, and the judgment is inherently subjective:

- Remove on-chain web rendering and the contract cannot see the suspect page at all. There is
  no API or dataset for arbitrary suspect URLs.
- Remove subjective AI judgment and "does page A impersonate brand B" collapses into string
  matching, which attackers evade trivially.
- Remove validator consensus and a single renderer plus a single model becomes the trusted
  decider — exactly the centralized service the protocol replaces.

One property makes this unusual: **the evidence source is adversarial**. A phishing page can
embed instructions aimed at the model reading it. Deterministic validator-side defenses are
therefore a core feature, not a checklist item — see "Prompt-injection defenses" below.

## Architecture

Three contracts, in `contracts/`:

- **`brand_registry.py`** — deterministic registry of brands: name, official domains
  (normalized and globally unique), scope note, admin, active flag. Holds no funds.
- **`phish_report_core.py`** — the intelligent core: bounty pools, hunter stakes, the report
  state machine, the non-deterministic adjudication, appeals, settlement, payouts, and
  domain re-verification. Reads the registry and writes the blocklist.
- **`blocklist_log.py`** — append-only event log (`LISTED` / `NEUTRALIZED` / `RELISTED`) with a
  single authorized writer. Public views such as `is_blocked(domain)` make it consumable by
  other contracts and applications.

### Adjudication and consensus

Inside `gl.vm.run_nondet_unsafe`, the leader renders the suspect page and the official brand
page and asks the model for a strict JSON verdict. Every validator repeats the whole
procedure independently and then compares the **semantic decision**, not the wording: the
verdict must match exactly, confidence must agree within 20 points, and the
evidence-sufficiency flag must match. Free-form reasoning is never compared byte for byte.

Graduated outcomes — `CONFIRMED_PHISHING`, `SUSPICIOUS`, `CLEARED` — carry a confidence score,
a set of observed signal codes, and an actionable reason. Infrastructure failures (dead page,
malformed model output) produce `UNDETERMINED` with one retry rather than a false verdict; a
dead suspect page is never treated as exoneration.

### Prompt-injection defenses

Page content is untrusted attacker-controlled input, so the validator function is fully
deterministic and never calls a model. It bounds the decision space: the verdict must be one
of three allowed values, confidence must be an integer in range, signal codes must be known
and non-contradictory, the payload must be under 2 KB, and verdict/confidence/signal
combinations must be internally coherent. Brand identity facts come only from registry state,
so a page claiming to be the official site cannot change what it is compared against.

## Repository structure

```text
phishbounty/
├── contracts/            # the three Intelligent Contracts
├── tests/                # pytest suite + a hand-written GenVM runtime stub
├── docs/SPEC.md          # full technical specification
├── scripts/              # diagnostic tooling (Studio value-scale probe)
└── frontend/             # React + TypeScript dApp (genlayer-js)
    ├── src/
    └── public/fixtures/  # static adjudication targets
```

## Running the tests

```bash
python -m pytest tests/ -q
```

The suite covers the guard chain, the report state machine, payout and pool arithmetic, the
verdict-payload parser, validator acceptance and rejection, and the whole-GEN economics rules.
It runs against a pure-Python GenVM stub written for this repository, which deliberately
mirrors real runtime semantics that unit tests would otherwise hide (for example, rejecting
`Address(int)` and `DynArray(...)` construction).

## Running the frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Reads work without a wallet. Writes require MetaMask on Studionet. The interface advances
only after a transaction is finalized **and** its execution result is success, and it shows
the consensus stage rather than an open-ended spinner.

## Economics

All payable amounts are whole GEN, because the Studio interface accepts only whole-GEN
integers while the runtime delivers value in wei. A first pool deposit is at least 5 GEN;
bounties run 5–500 GEN in multiples of 5, which keeps the hunter stake (bounty ÷ 5) and the
appeal stake (2× stake) whole. See [docs/SPEC.md](docs/SPEC.md) §11.

## Test fixtures

`frontend/public/fixtures/` contains two static pages that give adjudication stable targets:
an impersonation sample and a benign control. The impersonation sample mimics **"Example
Brand"**, a fictional company on `example.com` — an IANA-reserved documentation domain, not a
real business. Its form is inert, it issues no network requests, it stores nothing, and it is
served with `X-Robots-Tag: noindex`.

## Documentation

[docs/SPEC.md](docs/SPEC.md) holds the domain model, storage layout, state machine, consensus
strategy, edge cases, economics, and deployment plan.
