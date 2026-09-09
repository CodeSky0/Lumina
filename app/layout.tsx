import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumina 流光",
  description: "极简实时家校沟通平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="font-sans">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
