"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose?: () => void;
  blocking?: boolean;
  fullscreen?: boolean;
  className?: string;
}

export function Dialog({ open, title, description, children, onClose, blocking = false, fullscreen = false, className }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
    ) ?? []);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !blocking) onClose?.();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [open, blocking, onClose]);

  if (!open) return null;
  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6", fullscreen && "p-0 sm:p-0")} role="presentation">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={blocking ? undefined : onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn("relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-paper p-6 shadow-whisper-lg animate-enter sm:p-7", className, fullscreen && "flex h-[100dvh] max-h-none max-w-none flex-col justify-center rounded-none p-8 sm:p-12")}
      >
        <div className="mb-6 flex items-start justify-between gap-5">
          <div>
            <h2 id={titleId} className="text-title-24 font-medium tracking-tight text-neutral-10">{title}</h2>
            {description && <p id={descriptionId} className="mt-2 text-copy-14 leading-6 text-neutral-7">{description}</p>}
          </div>
          {!blocking && onClose && <Button variant="ghost" size="touchIcon" onClick={onClose} aria-label="关闭对话框"><X className="h-5 w-5" /></Button>}
        </div>
        {children}
      </div>
    </div>
  );
}