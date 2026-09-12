"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Lumina Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-1 px-4">
      <div className="text-center">
        <h1 className="text-title-28 font-bold text-neutral-9">
          出错了
        </h1>
        <p className="mt-2 text-copy-14 text-neutral-6">
          {error.message || "页面加载时发生未知错误"}
        </p>
        {error.digest && (
          <p className="mt-1 text-caption-10 text-neutral-5">
            错误代码：{error.digest}
          </p>
        )}
      </div>
      <Button variant="primary" size="md" onClick={reset}>
        重试
      </Button>
    </div>
  );
}
