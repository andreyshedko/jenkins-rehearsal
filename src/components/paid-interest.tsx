"use client";
import { useEffect, useRef, useState } from "react";
import type { ScanSession } from "./scanner";
import { track } from "./report";
export default function PaidInterest({ session }: { session: ScanSession }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void track(session, "paid_rehearsal_cta_viewed");
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [session]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId: session.scanId,
          token: session.token,
          email: f.get("email"),
          company: f.get("company"),
          controllerCount: Number(f.get("controllers")),
          jobCountRange: f.get("jobs"),
          pluginCountRange: f.get("plugins"),
          message: f.get("message"),
          statedPaidInterest: f.get("interest") === "on",
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error);
        return;
      }
      setSuccess(true);
    } catch {
      setMessage("Unable to submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="paid" ref={ref}>
      <p className="eyebrow">NEXT STEP / BETA INTEREST</p>
      <h2>Want to know whether it actually boots?</h2>
      <p>
        Static metadata cannot prove that a real Jenkins controller with your
        configuration will start successfully after the upgrade.
      </p>
      <div className="paid-offer">
        <div>
          <strong>Private local upgrade rehearsal — beta</strong>
          <p>Planned product · not available yet</p>
        </div>
        <strong className="price">
          $199 <small>/ controller</small>
        </strong>
      </div>
      <p>
        The proposed beta would run against a local copy of Jenkins.
        JENKINS_HOME and credentials would remain in your environment; only
        sanitized test results would be sent to the service.
      </p>
      <p>
        It would boot the target Jenkins/plugin stack in isolation and report
        plugin, configuration and job loading failures.
      </p>
      {!open && (
        <button
          className="button"
          onClick={() => {
            setOpen(true);
            void track(session, "paid_rehearsal_cta_clicked");
          }}
        >
          Request paid rehearsal →
        </button>
      )}
      {open &&
        (success ? (
          <div role="status" className="success">
            Interest recorded. No payment has been taken. Thank you for helping
            validate the beta.
          </div>
        ) : (
          <form onSubmit={submit} className="lead-form">
            <p>No checkout or payment. Tell us about your installation.</p>
            <div className="lead-grid">
              <label>
                Work email
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
              <label>
                Company <span className="muted">(optional)</span>
                <input
                  name="company"
                  maxLength={200}
                  autoComplete="organization"
                />
              </label>
              <label>
                Jenkins controllers
                <input
                  name="controllers"
                  type="number"
                  defaultValue={1}
                  min={1}
                  max={100000}
                  required
                />
              </label>
              <label>
                Approximate jobs
                <select name="jobs">
                  {["unknown", "1-50", "51-200", "201-1000", "1000+"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Approximate plugins
                <select
                  name="plugins"
                  defaultValue={
                    session.report.pluginCount < 20
                      ? "1-19"
                      : session.report.pluginCount < 50
                        ? "20-49"
                        : session.report.pluginCount < 100
                          ? "50-99"
                          : "100+"
                  }
                >
                  {["unknown", "1-19", "20-49", "50-99", "100+"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Comment <span className="muted">(optional; no secrets)</span>
              <textarea name="message" maxLength={2000} rows={3} />
            </label>
            <label className="checkbox">
              <input name="interest" type="checkbox" required />I would consider
              paying $199/controller for this beta if my Jenkins qualifies.
            </label>
            <p className="hint">
              We retain these details to assess and follow up on beta interest.
              See our <a href="/privacy">privacy notice</a>.
            </p>
            {message && (
              <p role="alert" className="error-box">
                {message}
              </p>
            )}
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Recording…" : "Submit paid-beta interest"}
            </button>
          </form>
        ))}
    </section>
  );
}
