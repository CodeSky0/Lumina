"use client";

import { motion, AnimatePresence } from "motion/react";
import { PoseArt, CAT_DIM, type CatPose } from "./cat-sprites";
import { EASE } from "@/lib/motion";

const BREATH: Partial<Record<CatPose, { scale?: number[]; y?: number[]; duration: number }>> = {
  sleep: { scale: [1, 1.045, 1], duration: 3.6 },
  idle: { scale: [1, 1.02, 1], duration: 3 },
  sit: { scale: [1, 1.02, 1], duration: 3.2 },
  lie: { scale: [1, 1.018, 1], duration: 3.4 },
  groom: { scale: [1, 1.02, 1], duration: 3 },
  yawn: { scale: [1, 1.02, 1], duration: 3.4 },
  stretch: { scale: [1, 1.03, 1], duration: 2.8 },
  walk: { y: [0, -2, 0], duration: 0.5 },
};

export function OrangeCat({
  pose,
  facing = "right",
  size = 48,
  className,
}: {
  pose: CatPose;
  facing?: "left" | "right";
  size?: number;
  className?: string;
}) {
  const ratio = CAT_DIM.w / CAT_DIM.h;
  const w = Math.round(size * ratio);
  const breath = BREATH[pose];

  return (
    <motion.div
      className={className}
      style={{ width: w, height: size, willChange: "transform" }}
      animate={
        breath
          ? {
              scale: breath.scale,
              y: breath.y,
            }
          : undefined
      }
      transition={
        breath
          ? { duration: breath.duration, repeat: Infinity, ease: "easeInOut" }
          : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={pose}
          viewBox={`0 0 ${CAT_DIM.w} ${CAT_DIM.h}`}
          width={w}
          height={size}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.18, ease: EASE.out }}
          style={{ overflow: "visible" }}
        >
          <g transform={facing === "left" ? `matrix(-1 0 0 1 ${CAT_DIM.w} 0)` : undefined}>
            <PoseArt pose={pose} />
          </g>
        </motion.svg>
      </AnimatePresence>
    </motion.div>
  );
}
