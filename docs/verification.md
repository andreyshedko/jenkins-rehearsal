# Verification record · 2026-09-30

- Domain/parser: initial 39 tests passed before metadata work.
- Metadata: fixture normalization/provider tests passed; live ingestion activated LTS 2.580.1 with 2,113 plugins. Wildcard advisory bounds discovered upstream have a regression test.
- Analysis: current/old core and Java, unknown comparisons, advisory false positives, deprecations, target absence, required core, dependency constraints, optional dependencies and cycles tested.
- Final automated run: **77 Vitest tests** across five suites passed, including execution of the SQL migration in PGlite. Coverage gates passed.
- Strict TypeScript, ESLint, formatting check and Next.js production build passed.
- **Two Playwright browser tests** passed: real scan API through report and honest unconfigured beta submission; mobile text upload, duplicate line errors, no horizontal page overflow and privacy navigation.
- Desktop landing/report and mobile layout were visually inspected. No framework error overlay appeared.

The final build/test run used `/tmp/jenkins-scanner-validation`, a clean copy with freshly installed dependencies, because reads from the workspace's cloud-synced node_modules became intermittently stalled. Source changes remain in the original workspace. A temporary development preview runs on port 3002 using the live official snapshot.

Not verified against external infrastructure: hosted Supabase credentials and deployment to Vercel. The SQL migration was executed locally and transaction/role behavior tested, but a deployed service still needs its documented setup and a hosted smoke test. No external project or production deployment was created.

Known intentional limitations: conservative Jenkins version subset; unknown rather than guessed Java-regex advisory membership; runtime policy requires maintenance; static metadata cannot validate controller startup or jobs. No rehearsal engine exists.
