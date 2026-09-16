"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { CatEngine, type Facing, type PoseChange } from "./cat-engine";
import { PerchDetector, detectPerches, type Perch } from "./perch-detector";
import type { CatPose } from "./cat-sprites";

export interface CatPoseState {
  pose: CatPose;
  facing: Facing;
}

function pickInitial(perches: Perch[]): { x: number; y: number; facing: Facing } {
  const sidebarBars = perches.filter(
    (p) => p.type === "bar" && p.x1 < 300 && p.x2 - p.x1 > 40 && p.y > 40,
  );
  if (sidebarBars.length > 0) {
    const p = sidebarBars.sort((a, b) => b.y - a.y)[0]!;
    return { x: p.x2 - 28, y: p.y, facing: "right" };
  }
  const ground = perches.find((p) => p.type === "ground");
  if (ground) return { x: 140, y: ground.y, facing: "right" };
  return { x: 140, y: window.innerHeight - 4, facing: "right" };
}

export function useCat(containerRef: RefObject<HTMLElement | null>) {
  const [poseState, setPoseState] = useState<CatPoseState>({ pose: "idle", facing: "right" });
  const [ready, setReady] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CatEngine | null>(null);
  const detectorRef = useRef<PerchDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const initialPerches = detectPerches(container);
    const init = pickInitial(initialPerches);

    if (prefersReduced) {
      setPoseState({ pose: "sleep", facing: init.facing });
      requestAnimationFrame(() => {
        const el = catRef.current;
        if (el) {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          el.style.transform = `translate3d(${init.x - w / 2}px, ${init.y - h}px, 0)`;
        }
      });
      setReady(true);
      return;
    }

    const engine = new CatEngine({
      perches: initialPerches,
      initialX: init.x,
      initialY: init.y,
      initialFacing: init.facing,
      onPoseChange: (c: PoseChange) => setPoseState({ pose: c.pose, facing: c.facing }),
    });
    engineRef.current = engine;

    const detector = new PerchDetector(container, (perches: Perch[]) => {
      engineRef.current?.setPerches(perches);
    });
    detectorRef.current = detector;
    detector.start();

    const loop = (): void => {
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const el = catRef.current;
      const eng = engineRef.current;
      if (el && eng) {
        const out = eng.step();
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        el.style.transform = `translate3d(${out.x - w / 2}px, ${out.y - h}px, 0)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const onVisibility = (): void => {
      pausedRef.current = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    setReady(true);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      detector.stop();
      document.removeEventListener("visibilitychange", onVisibility);
      engineRef.current = null;
      detectorRef.current = null;
    };
  }, [containerRef]);

  const poke = useCallback((x: number, y: number, onCat: boolean): void => {
    engineRef.current?.poke(x, y, onCat);
  }, []);

  return { catRef, poseState, ready, poke };
}
