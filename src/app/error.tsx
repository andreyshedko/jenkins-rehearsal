"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="prose">
      <h1>Something went wrong.</h1>
      <p>Please try again. Your inventory has not been logged.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
