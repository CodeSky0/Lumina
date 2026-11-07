"use client";

import type { ReactNode } from "react";
import { ArrowClockwise, Info, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-2 text-neutral-6">
        {icon ?? <Info className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h3 className="text-title-20 font-medium text-neutral-10">{title}</h3>
      <p className="mt-2 max-w-sm text-copy-14 leading-6 text-neutral-7">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "内容加载失败" }: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message = error instanceof Error ? error.message : "发生了未知错误，请稍后重试";
  return (
    <div role="alert" className="flex min-h-40 flex-col items-center justify-center px-6 py-10 text-center">
      <WarningCircle className="mb-3 h-7 w-7 text-error" aria-hidden="true" />
      <h3 className="text-title-20 font-medium text-neutral-10">{title}</h3>
      <p className="mt-2 max-w-md text-copy-14 leading-6 text-neutral-7">{message}</p>
      {onRetry && <Button className="mt-5" variant="secondary" onClick={onRetry}><ArrowClockwise className="h-4 w-4" />重新加载</Button>}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="rounded-md border border-error/25 bg-error/8 px-3 py-2.5 text-copy-13 leading-5 text-error">{error instanceof Error ? error.message : String(error)}</p>;
}