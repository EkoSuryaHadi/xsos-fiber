import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POINTS OF PRESENCE — IXP Orchestration Portal",
  description: "Xenoptics XSOS Remote Fiber Management & Monitoring System",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
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
