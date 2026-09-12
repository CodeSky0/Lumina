"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function RouteCurtain() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const curtainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    const curtain = curtainRef.current;
    if (!curtain) return;
    curtain.style.transition = "none";
    curtain.style.transform = "translateX(-100%)";
    curtain.style.opacity = "0";
    requestAnimationFrame(() => {
      curtain.style.transition =
        "transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.5s cubic-bezier(0.16,1,0.3,1)";
      curtain.style.transform = "translateX(120%)";
      curtain.style.opacity = "1";
    });
    window.setTimeout(() => {
      if (!curtainRef.current) return;
      curtainRef.current.style.transition = "none";
      curtainRef.current.style.transform = "translateX(-100%)";
      curtainRef.current.style.opacity = "0";
    }, 650);
  }, [pathname]);

  return (
    <div
      ref={curtainRef}
      aria-hidden
      className="pointer-events-none fixed inset-y-0 left-0 z-[55] w-1/3"
      style={{ transform: "translateX(-100%)", opacity: 0 }}
    >
      <div className="h-full w-full bg-gradient-to-r from-transparent via-accent/25 to-transparent blur-sm" />
    </div>
  );
}
