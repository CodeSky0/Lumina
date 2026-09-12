"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/lib/motion";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-8 w-8" />;
  }

  const isDark = theme === "dark";

  function handleToggle(e: React.MouseEvent<HTMLButtonElement>) {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const toDark = !isDark;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const r = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
    overlay.style.background = toDark ? "rgb(28, 28, 30)" : "#fefefb";
    overlay.style.transition = "none";
    overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;
    requestAnimationFrame(() => {
      overlay.style.transition = "clip-path 0.6s cubic-bezier(0.16,1,0.3,1)";
      overlay.style.clipPath = `circle(${r}px at ${x}px ${y}px)`;
    });
    window.setTimeout(() => setTheme(toDark ? "dark" : "light"), 300);
    window.setTimeout(() => {
      overlay.style.transition = "none";
      overlay.style.clipPath = "circle(0px at 50% 50%)";
    }, 650);
  }

  return (
    <>
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60]"
        style={{ clipPath: "circle(0px at 50% 50%)" }}
      />
      <button
        onClick={handleToggle}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-neutral-7 transition-colors hover:bg-neutral-2 hover:text-neutral-9"
        aria-label={isDark ? "切换到亮色模式" : "切换到暗色模式"}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isDark ? "dark" : "light"}
            className="flex items-center justify-center"
            initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
            transition={{ duration: 0.28, ease: EASE.spring }}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </>
  );
}
