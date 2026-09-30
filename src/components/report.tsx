"use client";
import { useEffect, useRef } from "react";
import type { Finding } from "@/lib/jenkins/types";
import type { ScanSession } from "./scanner";
import PaidInterest from "./paid-interest";
export async function track(
  session: ScanSession,
  name:
    | "report_viewed"
    | "paid_rehearsal_cta_viewed"
    | "paid_rehearsal_cta_clicked",
) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scanId: session.scanId,
        token: session.token,
        name,
      }),
      keepalive: true,
    });
  } catch {
    /* Analytics failure must not hide the report. */
  }
}
function Findings({
  title,
  items,
  empty,
}: {
  title: string;
  items: Finding[];
  empty: string;
}) {
  return (
    <section className="report-section">
      <h3>
        {title}
        <span className="count">{items.length}</span>
      </h3>
      {items.length ? (
        <ul className="findings">
          {items.map((f, i) => (
            <li key={`${f.code}-${i}`}>
              <span className={`badge ${f.severity.toLowerCase()}`}>
                {f.severity}
              </span>
              <div>
                {f.pluginId && (
                  <strong className="mono">{f.pluginId} · </strong>
                )}
                {f.message}
                {f.reference && (
                  <a
                    className="reference"
                    href={f.reference}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Jenkins reference ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}
export default function Report({ session }: { session: ScanSession }) {
  const { report: r } = session;
  const sent = useRef(false);
  useEffect(() => {
    if (!sent.current) {
      sent.current = true;
      void track(session, "report_viewed");
    }
  }, [session]);
  const blockers = r.findings.filter((f) => f.severity === "BLOCKER");
  return (
    <article className="panel report" aria-label="Jenkins upgrade report">
      <div className="section-heading">
        <div>
          <p className="eyebrow">JENKINS UPGRADE REPORT</p>
          <h2>Your upgrade, mapped out.</h2>
        </div>
        <span className="tag">STATIC ANALYSIS</span>
      </div>
      {!session.persistence && (
        <p className="notice">
          Local preview: scan analytics and beta interest are not saved until
          Supabase is configured.
        </p>
      )}
      {r.snapshot.source === "fixture" && (
        <p className="notice">
          Fixture demonstration — these are synthetic results, not current
          Jenkins metadata.
        </p>
      )}
      <div className="report-summary">
        <div>
          <p className="eyebrow">CURRENT</p>
          <strong>Jenkins {r.currentJenkinsVersion}</strong>
          <p>
            Java {r.javaVersion ?? "unknown"} · {r.pluginCount} plugins
          </p>
        </div>
        <div>
          <p className="eyebrow">TARGET / LATEST LTS</p>
          <strong>Jenkins {r.targetJenkinsVersion}</strong>
          <p>
            {r.coreComparison === -1
              ? "Core upgrade available"
              : r.coreComparison === 0
                ? "Already on the target LTS"
                : r.coreComparison === 1
                  ? "Current core is newer than target"
                  : "Core comparison unknown"}
          </p>
        </div>
        <div>
          <p className="eyebrow">UPGRADE COMPLEXITY</p>
          <strong className="complexity">{r.complexity}</strong>
          <p>Preparation effort, not failure probability</p>
        </div>
      </div>
      <div className="drivers">
        <strong>Why this classification</strong>
        <ul>
          {r.drivers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
      <p className="scope-note">
        This scanner performs static metadata analysis. It does not boot a copy
        of your Jenkins or execute your jobs.
      </p>
      <Findings
        title="Blockers"
        items={blockers}
        empty="Static analysis found no known blocker. Unknowns and untested configuration can still affect your upgrade."
      />
      <section className="report-section">
        <h3>Core &amp; Java</h3>
        <p>
          Current Java support:{" "}
          <b>
            {r.java.current === null
              ? "unknown"
              : r.java.current
                ? "supported"
                : "not supported"}
          </b>{" "}
          · Target Java support:{" "}
          <b>
            {r.java.target === null
              ? "unknown"
              : r.java.target
                ? "supported"
                : "not supported"}
          </b>
        </p>
        <p>
          Target supported runtimes:{" "}
          {r.java.supportedTarget?.map((v) => `Java ${v}`).join(" or ") ??
            "unknown"}
          .
        </p>
        {r.findings
          .filter(
            (f) =>
              (f.category === "java" || f.category === "core") &&
              f.severity !== "BLOCKER",
          )
          .map((f) => (
            <p className="notice" key={f.code}>
              {f.message}
            </p>
          ))}
      </section>
      <Findings
        title="Security"
        items={r.findings.filter((f) => f.category === "security")}
        empty="No matching advisory found in the available metadata. This is not a security audit."
      />
      <section className="report-section">
        <h3>
          Plugin compatibility <span className="count">{r.pluginCount}</span>
        </h3>
        <p className="muted">
          An offered update is a proposed preparation step, not proof that your
          installed release is incompatible. Required core describes the offered
          release.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Plugin</th>
                <th>Installed</th>
                <th>Target catalog</th>
                <th>Required core</th>
                <th>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {r.plugins
                .filter((p) => !p.transitive)
                .map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.id}</td>
                    <td className="mono">{p.installedVersion}</td>
                    <td className="mono">{p.offeredVersion ?? "Not found"}</td>
                    <td className="mono">{p.requiredCore ?? "Unknown"}</td>
                    <td>
                      <span className="badge">
                        {p.status.replaceAll("-", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {r.findings
          .filter((f) => f.category === "compatibility")
          .map((f, i) => (
            <p key={i} className="notice">
              <b>{f.pluginId}:</b> {f.message}
            </p>
          ))}
      </section>
      <Findings
        title="Deprecated / maintenance risks"
        items={r.findings.filter((f) => f.category === "maintenance")}
        empty="No explicit deprecations found for these plugins in the catalog."
      />
      <Findings
        title="Dependency changes"
        items={r.findings.filter((f) => f.category === "dependency")}
        empty="No dependency issues found in the proposed graph."
      />
      <details className="dependency-details">
        <summary>
          Inspect proposed releases and dependency lists ({r.plugins.length})
        </summary>
        {r.plugins.map((p) => (
          <div key={p.id}>
            <strong className="mono">{p.id}</strong> —{" "}
            {p.transitive ? "transitive addition" : "direct plugin"} · proposed{" "}
            {p.proposedVersion ?? "unresolved"}
            <p className="hint">
              {p.dependencies.length
                ? p.dependencies
                    .map(
                      (d) =>
                        `${d.id} ≥ ${d.version}${d.optional ? " (optional)" : ""}`,
                    )
                    .join(" · ")
                : p.status === "unknown" ||
                    p.status === "newer-installed" ||
                    p.status === "missing"
                  ? "Dependency metadata unknown"
                  : "No dependencies declared"}
            </p>
          </div>
        ))}
      </details>
      <section className="report-section">
        <h3>Recommended preparation steps</h3>
        <ol className="recommendations">
          {r.recommendations.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <a
          href="https://www.jenkins.io/doc/upgrade-guide/"
          target="_blank"
          rel="noreferrer"
        >
          Jenkins LTS upgrade guides ↗
        </a>
      </section>
      <p className="metadata-note">
        Snapshot generated {r.snapshot.generatedAt.slice(0, 10)} · Upstream{" "}
        {r.snapshot.sourceGeneratedAt?.slice(0, 10) ?? "unknown"} ·{" "}
        <a href={r.snapshot.sourceUrl} target="_blank" rel="noreferrer">
          Jenkins metadata ↗
        </a>
      </p>
      <PaidInterest session={session} />
    </article>
  );
}
