import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XSOS Fiber Cross-Connect Monitor & Control",
  description: "Xenoptics XSOS Remote Fiber Management & Monitoring System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
