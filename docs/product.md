# Product scope

M0 answers “What should I investigate before upgrading Jenkins?” It acquires Jenkins administrators through useful free static analysis and measures stated willingness to pay $199 per controller for a planned private local rehearsal.

The report is the product. It shows current core/Java, latest LTS, runtime blockers, version-aware advisories, plugin offers, deprecations, dependency changes, unknowns, and explainable preparation complexity. No result is labeled safe. An offered update does not imply the old release is incompatible.

The planned beta would boot a copy locally, retaining JENKINS_HOME and credentials in the customer's environment and sending only sanitized results. This is descriptive product intent, not an available capability. The CTA records explicit willingness to consider paying, never a charge or commitment.

Non-goals: local rehearsal engine, Jenkins connections, credentials, job execution, automated upgrades, accounts, checkout, LLM analysis, generic marketing pages, plugin binary analysis, build-JDK verification, support contracts.

Milestones implemented in order: domain/parser; metadata ingestion; analysis; scanner/report UI; intent/events; hardening/documentation. Tests verify correctness at each boundary. Complexity rules and business qualification rules are independent configurable TypeScript values in `src/lib/scanner/complexity.ts`.
