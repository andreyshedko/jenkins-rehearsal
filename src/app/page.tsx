import Scanner from "@/components/scanner";
export default function Home() {
  return (
    <main id="main">
      <section className="hero">
        <p className="eyebrow">
          <span className="dot" /> BEFORE THE MAINTENANCE WINDOW
        </p>
        <h1>
          Test your Jenkins upgrade
          <br />
          <span>before production.</span>
        </h1>
        <p className="intro">
          Free static upgrade-risk scan for Jenkins core, Java and plugins.
          <br className="desktop" /> No Jenkins credentials required.
        </p>
        <a className="button" href="#scanner">
          Scan my Jenkins <span aria-hidden="true">↗</span>
        </a>
        <div className="trust">
          <span>✓ No Jenkins credentials</span>
          <span>✓ No JENKINS_HOME upload</span>
          <span>✓ Uses Jenkins project metadata</span>
          <span>✓ Results in seconds</span>
        </div>
      </section>
      <section className="workflow" aria-label="How it works">
        <div>
          <span>01</span> Paste plugin inventory
        </div>
        <div>
          <span>02</span> Choose Jenkins &amp; Java versions
        </div>
        <div>
          <span>03</span> Review blockers &amp; compatibility risks
        </div>
      </section>
      <Scanner />
      <section className="method">
        <h2>Can I safely upgrade my Jenkins?</h2>
        <p>
          Start with what the metadata can tell you. This scanner checks known
          runtime requirements, plugin releases, advisories and dependencies
          against the latest Jenkins LTS.
        </p>
        <p>
          This scanner performs static metadata analysis. It does not boot a
          copy of your Jenkins or execute your jobs.
        </p>
      </section>
    </main>
  );
}
