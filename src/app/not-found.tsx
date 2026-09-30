import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="prose">
      <h1>Page not found.</h1>
      <Link href="/">Return to scanner</Link>
    </main>
  );
}
