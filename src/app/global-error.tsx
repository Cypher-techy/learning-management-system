"use client";

/** Last-resort fallback when the root layout itself cannot render. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>The service is temporarily unavailable</h1>
        <p style={{ color: "#555", marginTop: "0.5rem" }}>Please try again in a moment.</p>
        <button
          onClick={reset}
          style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #999", background: "#fff" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
