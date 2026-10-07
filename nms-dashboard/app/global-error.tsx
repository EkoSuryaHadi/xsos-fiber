"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <h2 style={{ color: "#d03b3b" }}>Kesalahan Sistem</h2>
        <p style={{ color: "#5c6b7a" }}>{error?.message || "Terjadi kesalahan fatal pada aplikasi."}</p>
        <button
          onClick={() => reset()}
          style={{
            background: "#003366",
            color: "#ffffff",
            border: "none",
            padding: "8px 18px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Coba Lagi
        </button>
      </body>
    </html>
  );
}
