# Jenkins metadata & correctness boundaries

## Authoritative sources

- Latest LTS: https://updates.jenkins.io/stable/latestCore.txt
- Version-specific catalog: https://updates.jenkins.io/update-center.json?version=TARGET
- Site semantics: https://updates.jenkins.io/ and https://github.com/jenkins-infra/update-center2/blob/master/site/README.md
- Version semantics inspected before implementation: https://github.com/jenkinsci/lib-version-number/blob/master/src/main/java/hudson/util/VersionNumber.java
- Java matrix: https://www.jenkins.io/doc/book/platform-information/support-policy-java/

No third-party sites are scraped. Redirects to Jenkins distribution mirrors are expected. Downloads use HTTPS and a 16 MiB decompressed-response cap. This application relies on HTTPS and schema validation; it does not verify the Java Update Center signature. Only the fixed known JSONP wrapper is removed, never evaluated.

The normalized snapshot stores target version, ingestion/source timestamps, source URL, plugin id/title/version/requiredCore/dependencies, explicit deprecation/reference, optional health score, and warning identifiers/references/ranges. Health score is not used as a compatibility claim. Release history and binaries are not mirrored because M0 does not need them.

## Version abstraction

The comparator intentionally implements a **subset**, not a full port of Jenkins VersionNumber. Numeric dot-separated components compare as arbitrary-precision integers, with trailing zero equivalence. Incremental versions such as `1337.v60b_d7b_c7b_c9f` and `1400.vabc` compare by differing numeric prefixes of equal component length. Equal hashes compare equal only when the full input strings match. Different hashes on equal prefixes return unknown. Different prefix lengths involving hashes return unknown.

Release candidates, qualifiers, timestamped Maven snapshots, arbitrary custom versions and wildcard advisory bounds return unknown unless exact valid strings are equal. No lexicographic version comparisons or SemVer package is used. This favors false unknowns over false compatibility/security claims. Fixtures record expected results for unusual formats. A future full comparator requires differential tests against the Jenkins Java library.

## Advisories

Jenkins ranges contain `firstVersion`, `lastVersion` and Java regex `pattern`. Bounds are inclusive. Out-of-range versions are excluded only by confident comparison. Exact boundary releases are considered affected. With no pattern, confident interval membership is supported. Pattern-bearing interior versions are **unknown**, because min/max can conceal holes and Java regex semantics are not JS semantics. Pattern-only ranges are unknown. Regexes are never evaluated. Wildcard bounds are retained and yield unknown. Multiple ranges use tri-state OR; a confirmed match takes precedence.

This deliberately underclaims rather than calling every installation of a historically affected plugin vulnerable. “No matching advisory” is never described as an audit or proof of safety. Core advisories are also checked against the installed core.

## Java policy

The matrix is separately editable JSON and distinguishes LTS (three numeric components) from weekly (two). It encodes supported runtimes rather than an unbounded minimum. Older unsupported history and custom versions return unknown. Rows are assumed to apply until the next published transition: operators must review this file whenever Jenkins changes runtime support. Runtime checks cover Jenkins controller/agents, not the build JDK.

## Ingestion verification

CI uses a small synthetic fixture and mocked network responses. The live development run on 2026-09-30 activated Jenkins LTS 2.580.1 with 2,113 catalog plugins. Advisory wildcard bounds discovered in that run are accepted as opaque metadata, not silently discarded or interpreted. Atomic activation tests verify rollback. No live internet is required in tests.
