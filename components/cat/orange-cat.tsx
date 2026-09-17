"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { CAT_DIM, type CatPose } from "./cat-sprites";
import { CatLottie, preloadCatLotties } from "./cat-lottie";
import { EASE } from "@/lib/motion";

const BREATH: Partial<Record<CatPose, { scale?: number[]; y?: number[]; duration: number }>> = {
  sleep: { scale: [1, 1.03, 1], duration: 3.6 },
  idle: { scale: [1, 1.015, 1], duration: 3.2 },
  sit: { scale: [1, 1.015, 1], duration: 3.4 },
  lie: { scale: [1, 1.012, 1], duration: 3.8 },
  groom: { scale: [1, 1.018, 1], duration: 3 },
  yawn: { scale: [1, 1.018, 1], duration: 3.4 },
  stretch: { scale: [1, 1.02, 1], duration: 2.8 },
  walk: { y: [0, -1.4, 0], duration: 0.5 },
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

  useEffect(() => {
    preloadCatLotties();
  }, []);

  return (
    <motion.div
      className={className}
      style={{ width: w, height: size, willChange: "transform" }}
      animate={breath ? { scale: breath.scale, y: breath.y } : undefined}
      transition={breath ? { duration: breath.duration, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <motion.div
        key={pose}
        initial={{ opacity: 0.4, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: EASE.spring }}
        style={{ width: w, height: size }}
      >
        <CatLottie pose={pose} facing={facing} size={size} />
      </motion.div>
    </motion.div>
  );
}
