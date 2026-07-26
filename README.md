# PhishBounty

PhishBounty is a brand-impersonation bounty protocol built on GenLayer. Brands fund dedicated bounty pools and register their official domains, while bug hunters stake GEN tokens to report suspected phishing or impersonation URLs. During adjudication, GenLayer validators render both the suspect web page and the official brand site directly within consensus to evaluate visual and textual mimicry; confirmed malicious domains trigger automated payouts to hunters and populate an on-chain queryable blocklist.

## Status

In development. Not yet deployed. No contract addresses exist yet.

## Trust problem

Determining whether a website is a malicious phishing page carries significant financial and operational consequences, yet traditional approaches rely on inherently centralized or untrusted parties. Single brand operators could abuse automated takedown systems to suppress legitimate competition or critique, while unverified hunters may flood the system with fraudulent reports to extract bounties. Furthermore, centralized anti-phishing blocklists operate as opaque single points of failure with unverifiable detection criteria. Evaluating hostile web pages requires analyzing live, un-structured web content directly within consensus to reach a decentralized, tamper-proof decision.

## Architecture

- `BrandRegistry`: Deterministic registry storing registered brand profiles, official domain mappings, and scope notes.
- `PhishReportCore`: Intelligent core contract managing bounty pools, hunter stakes, non-deterministic consensus adjudication, appeals, and settlements.
- `BlocklistLog`: Deterministic, append-only event registry recording confirmed and neutralized phishing domains for external contract consumption.

## Repository structure

```text
phishbounty/
├── contracts/
├── docs/
│   └── SPEC.md
├── frontend/
├── scripts/
└── tests/
    └── stubs/
```

## Documentation

Detailed technical design, threat models, and protocol state machines are documented in [docs/SPEC.md](docs/SPEC.md).
