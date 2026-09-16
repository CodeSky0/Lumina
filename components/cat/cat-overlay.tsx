"use client";

import { useRef } from "react";
import { useCat } from "./use-cat";
import { OrangeCat } from "./orange-cat";

const CAT_CSS = `
.cat-overlay {
  --cat-fur: #F4A261;
  --cat-fur-dark: #D9792A;
  --cat-belly: #FBF3E7;
  --cat-nose: #E8A0A0;
  --cat-eye: #5B8C3A;
  --cat-outline: #6B3A1A;
  --cat-white: #FFFFFF;
}
.dark .cat-overlay {
  --cat-fur: #C98445;
  --cat-fur-dark: #A85E1F;
  --cat-belly: #4A4036;
  --cat-nose: #B07878;
  --cat-eye: #7BA84E;
  --cat-outline: #3A2010;
  --cat-white: #E8E0D0;
}
`;

export function CatOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { catRef, poseState, ready, poke } = useCat(containerRef);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CAT_CSS }} />
      <div
        ref={containerRef}
        className="cat-overlay"
        style={{ position: "fixed", inset: 0, zIndex: 30, pointerEvents: "none" }}
        aria-hidden
      >
        <div
          ref={catRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "auto",
            cursor: "pointer",
            willChange: "transform",
            touchAction: "none",
            opacity: ready ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
          onClick={(e) => {
            e.stopPropagation();
            poke(e.clientX, e.clientY, true);
          }}
        >
          <OrangeCat pose={poseState.pose} facing={poseState.facing} />
        </div>
      </div>
    </>
  );
}
