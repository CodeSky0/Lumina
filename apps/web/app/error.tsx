"use client";

import { ErrorState } from "@/components/ui/async-state";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="flex min-h-[100dvh] items-center justify-center p-6"><ErrorState error={error} onRetry={reset} title="页面暂时无法显示" /></main>;
}
