"use client";
import { useState, useRef } from "react";
import type { UpgradeReport } from "@/lib/jenkins/types";
import { MAX_INVENTORY_BYTES, parseInventory } from "@/lib/scanner/parser";
import Report from "./report";
export interface ScanSession {
  report: UpgradeReport;
  scanId: string;
  token: string;
  persistence: boolean;
}
export default function Scanner() {
  const [inventory, setInventory] = useState(""),
    [jenkins, setJenkins] = useState(""),
    [java, setJava] = useState("17"),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [session, setSession] = useState<ScanSession | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  async function upload(file?: File) {
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".txt") ||
      file.size > MAX_INVENTORY_BYTES
    ) {
      setErrors(["Choose a plain .txt file, at most 128 KiB."]);
      return;
    }
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      setInventory(text);
      setErrors([]);
    } catch {
      setErrors(["The file must contain plain UTF-8 text."]);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors([]);
    const parsed = parseInventory(inventory);
    if (parsed.errors.length) {
      setErrors(
        parsed.errors.map(
          (e) => `${e.line ? `Line ${e.line}: ` : ""}${e.message}`,
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentJenkinsVersion: jenkins.trim(),
          javaVersion: java === "unknown" ? null : Number(java),
          inventory,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(
          data.errors?.map(
            (e: { line: number; message: string }) =>
              `Line ${e.line}: ${e.message}`,
          ) ?? [data.error],
        );
        return;
      }
      setSession(data);
      setInventory("");
      requestAnimationFrame(() => reportRef.current?.focus());
    } catch {
      setErrors(["Unable to connect. Please try again."]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel scanner" id="scanner">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR ENVIRONMENT</p>
            <h2>Run an upgrade risk scan</h2>
          </div>
          <span className="tag">NO ACCOUNT NEEDED</span>
        </div>
        <form onSubmit={submit}>
          <div className="form-columns">
            <div>
              <label htmlFor="jenkins">Current Jenkins version</label>
              <input
                id="jenkins"
                placeholder="e.g. 2.440.3"
                required
                maxLength={128}
                value={jenkins}
                onChange={(e) => setJenkins(e.target.value)}
                autoComplete="off"
              />
              <p className="hint">
                Find this in the footer of your Jenkins controller.
              </p>
              <label htmlFor="java">Controller Java version</label>
              <select
                id="java"
                value={java}
                onChange={(e) => setJava(e.target.value)}
              >
                {[8, 11, 17, 21, 25].map((v) => (
                  <option key={v} value={v}>
                    Java {v}
                  </option>
                ))}
                <option value="unknown">Other / unknown</option>
              </select>
              <p className="hint">
                The runtime for Jenkins, not your build jobs.
              </p>
              <aside className="privacy-note">
                <span aria-hidden="true">⌁</span>
                <div>
                  <strong>Your inventory stays private.</strong>
                  <p>
                    Processed for this report, then discarded. We retain only
                    scan summaries and finding categories. Never paste
                    credentials, secrets or job configurations.
                  </p>
                </div>
              </aside>
            </div>
            <div>
              <div className="label-row">
                <label htmlFor="inventory">Installed plugin inventory</label>
                <label className="upload" htmlFor="upload">
                  Upload .txt <span aria-hidden="true">↑</span>
                </label>
                <input
                  id="upload"
                  className="visually-hidden"
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              <textarea
                id="inventory"
                spellCheck={false}
                value={inventory}
                onChange={(e) => setInventory(e.target.value)}
                placeholder={
                  "# One plugin per line\ngit:5.2.1\ncredentials:1337.v60b_d7b_c7b_c9f\nworkflow-aggregator:596.v8c21c963d92d"
                }
                required
                maxLength={131072}
              />
              <p className="hint">
                plugin-id:version · Comments with # are ignored · 128 KiB /
                2,000 plugins max
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setJenkins("2.440.3");
                  setJava("11");
                  setInventory(
                    "git:5.2.1\ncredentials:1337.v60b_d7b_c7b_c9f\nworkflow-aggregator:596.v8c21c963d92d",
                  );
                }}
              >
                Use example inventory
              </button>
            </div>
          </div>
          {errors.length > 0 && (
            <div role="alert" className="error-box">
              {errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <div className="form-footer">
            <p>Deterministic analysis. No AI. No connection to your Jenkins.</p>
            <button className="button" disabled={busy} type="submit">
              {busy ? "Analyzing metadata…" : "Generate upgrade report"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </section>
      {session && (
        <div ref={reportRef} tabIndex={-1} className="report-focus">
          <Report key={session.scanId} session={session} />
        </div>
      )}
    </>
  );
}
