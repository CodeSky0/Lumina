"use client";

import { type ReactNode, useEffect } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className = "" }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-md space-y-4 rounded-xl bg-neutral-2 p-6 ring-1 ring-border ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="font-serif text-title-20 font-medium text-neutral-10">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
