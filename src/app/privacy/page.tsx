import Link from "next/link";
export default function Privacy() {
  return (
    <main id="main" className="prose">
      <p className="eyebrow">PRIVACY &amp; METHODOLOGY</p>
      <h1>Your Jenkins stays yours.</h1>
      <h2>What is processed</h2>
      <p>
        The scanner receives your current Jenkins version, Java version and
        plugin IDs/versions over HTTPS. It holds the inventory in memory while
        generating the report. It never connects to your Jenkins installation.
      </p>
      <h2>What is retained</h2>
      <p>
        We store core/Java versions, plugin count and count bucket, complexity,
        blocker and advisory counts, metadata snapshot ID, and finding
        categories/codes. We do not store the raw inventory, individual plugin
        IDs or installed plugin versions. The report lives only in this browser
        tab’s memory; refreshing removes it.
      </p>
      <p>
        First-party events measure scan starts/completions, report views, beta
        offer views/clicks and stated paid interest. No third-party analytics
        receive your inventory. Short-lived hashed network identifiers limit
        abuse.
      </p>
      <h2>Beta interest</h2>
      <p>
        Submitting the optional beta form records your email, company,
        installation size, comment and willingness to consider $199/controller.
        No payment is collected. Do not include confidential information in the
        comment. The rehearsal product is planned and does not yet exist.
      </p>
      <h2>Retention</h2>
      <p>
        Deployment operators should run the documented cleanup monthly: derived
        scans and events expire after 90 days, beta interest after 180 days.
        Lead-associated scans are retained up to 180 days to evaluate
        qualification. Hosting infrastructure may record request metadata, but
        application logs exclude request bodies.
      </p>
      <h2>Limits of the report</h2>
      <p>
        Version comparison supports numeric releases and differing numeric
        prefixes of recognized Jenkins incremental releases. Ambiguous
        qualifiers, hashes and advisory patterns produce unknowns. Historical
        security advisories are evaluated against your installed versions, never
        merely by plugin name. Catalog updates are proposals, not evidence that
        an older plugin will fail.
      </p>
      <p>
        This scanner performs static metadata analysis. It does not boot a copy
        of your Jenkins or execute your jobs. It cannot prove an upgrade safe.
      </p>
      <Link href="/">← Back to scanner</Link>
    </main>
  );
}
