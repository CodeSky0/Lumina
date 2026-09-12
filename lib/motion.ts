import type { Variants, Transition } from "motion/react";

export const EASE = {
  standard: [0.25, 0.1, 0.25, 1] as const,
  out: [0.16, 1, 0.3, 1] as const,
  in: [0.7, 0, 0.84, 0] as const,
  spring: [0.34, 1.56, 0.64, 1] as const,
};

export const DURATION = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  page: 0.4,
};

export const springTransition: Transition = {
  duration: 0.32,
  ease: EASE.spring,
};

export const easeOutTransition: Transition = {
  duration: DURATION.normal,
  ease: EASE.out,
};

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const springPop: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

export const slideOver: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
};

export const staggerContainer = (stagger = 0.04, delay = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE.spring },
  },
};

export const charItem: Variants = {
  hidden: { opacity: 0, y: 6, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.36, ease: EASE.spring },
  },
};

export const inkBloom: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  visible: {
    opacity: [0, 0.55, 0],
    scale: [0.4, 1.25, 1],
    transition: { duration: 0.7, ease: EASE.out, times: [0, 0.55, 1] },
  },
};

export const checkDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.4, ease: EASE.out },
  },
};
