import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { RouteCurtain } from "@/components/route-curtain";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumina 流光",
  description: "极简实时家校沟通平台",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="font-sans" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <RouteCurtain />
          {children}
          <ServiceWorkerRegister />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
