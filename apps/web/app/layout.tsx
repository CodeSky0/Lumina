import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lumina 校园通讯", template: "%s · Lumina" },
  description: "面向高中教师、教室与管理员的校园即时通讯平台",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f9fb",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><a href="#main-content" className="skip-link">跳到主要内容</a><Providers>{children}</Providers></body>
    </html>
  );
}
