# Architecture

The browser posts bounded plain text and version selections to `/api/scan`. Zod validates the envelope, the parser validates each line, and the pure `analyzeUpgrade` function consumes an active normalized snapshot. The report returns directly to browser memory. No report retrieval URL or publicly enumerable scan record exists.

`src/lib/jenkins` owns version types, the conservative comparator, a data-driven Java matrix, metadata provider interfaces, fixture provider and official Update Center provider. `src/lib/scanner` owns parsing, security matching, dependency graph traversal, complexity and preparation recommendations. `src/lib/server` owns database access, HMAC session tokens, rate limits, request bounds and persistence. Components render domain results without making compatibility decisions.

## Snapshot lifecycle

Ingestion discovers the latest LTS separately from the Update Center's core field (which can describe a different release line). The request includes the target core. Every offered required-core field must compare at or below the target or the ingestion fails. Only normalized public metadata is retained.

The database stores one immutable normalized payload per snapshot. `plugin_catalog` and `security_warning` are security-invoker relational views over that payload, avoiding duplicate catalog storage. A transaction advisory lock serializes activation; a partial unique index permits one active snapshot. Any insert/validation failure rolls back the status change. Local development uses temporary-file write plus atomic rename.

## Proposed plugin graph

Installed plugins use offered target releases only where comparison confirms equal or newer. Newer or unordered installed releases are retained but their dependencies/core compatibility are unknown. Required dependencies are added transitively. Optional dependencies are checked only if installed. Minimum constraints apply to the proposed releases. Iterative DFS detects cycles without recursion depth risk. This is a preparation proposal, never an executable upgrade plan.

## Persistence and authorization

`persist_scan` atomically inserts summary fields, category/severity/code-only findings, and `scan_completed`. `scan_started` records a rate-limited endpoint attempt without input. Client events require an HMAC token bound to the scan UUID and a 24-hour expiry; allowlisted event names deduplicate per scan. `record_interest` atomically records a lead and the intent event, once per scan. No open read routes exist.

Postgres enforces RLS and denies browser roles all table/function access. Production requires a database and secret. Lead contact data is never included in analytics events. First-party events are inherently approximate: blockers, network failures and ad blockers can reduce view counts.

## Security constraints

JSON bodies are streamed with byte limits even when Content-Length is missing. Only UTF-8 text and bounded lexical versions are accepted; no decompression, dynamic code, uploaded executable files, or regex execution from upstream advisories. Same-origin browser requests are required. CSP, frame protection, nosniff, no-referrer and permissions policy are set. CSP currently allows inline scripts/styles for Next.js hydration; it does not allow arbitrary external origins. Logs contain fixed event identifiers only.

Input inventory and the response include sensitive installation metadata in transit over HTTPS. Use HTTPS on deployment; avoid reverse-proxy body capture and observability tools that collect request/response bodies. Raw inventory retention is not implemented.
