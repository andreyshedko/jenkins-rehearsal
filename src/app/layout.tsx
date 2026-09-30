import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Jenkins Upgrade Rehearsal — Free risk scanner",
  description:
    "Static Jenkins core, Java and plugin upgrade analysis. No Jenkins credentials required.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="topbar">
          <Link className="brand" href="/">
            <span className="brand-icon" aria-hidden="true">
              ↗
            </span>{" "}
            <span>
              Jenkins <b>Upgrade Rehearsal</b>
            </span>
          </Link>
          <span className="tag">M0 / FREE SCANNER</span>
        </header>
        {children}
        <footer>
          <span>
            Jenkins Upgrade Rehearsal · Independent tool, not affiliated with
            the Jenkins project.
          </span>
          <a href="/privacy">Privacy &amp; methodology</a>
        </footer>
      </body>
    </html>
  );
}
