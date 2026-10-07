"use client";

import React, { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Error:", error);
  }, [error]);

  return (
    <div style={{ padding: "40px 24px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2 style={{ color: "#d03b3b", marginBottom: "12px" }}>Terjadi Masalah pada Dashboard</h2>
      <p style={{ color: "#5c6b7a", fontSize: "14px", marginBottom: "20px" }}>
        {error?.message || "Kesalahan tidak terduga saat memuat antarmuka."}
      </p>
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
        Muat Ulang Komponen
      </button>
    </div>
  );
}
