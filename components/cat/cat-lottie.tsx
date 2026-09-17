"use client";

import { useEffect, useState } from "react";
import { Lottie } from "lottie-react";
import type { CatPose } from "./cat-sprites";
import { PoseArt, CAT_DIM } from "./cat-sprites";

const POSE_FILE: Partial<Record<CatPose, string>> = {
  idle: "idle",
  walk: "walk",
  sit: "sit",
  lie: "sit",
  sleep: "sleep",
  stretch: "idle",
  groom: "sit",
  play: "play",
  jump: "play",
  fall: "play",
  yawn: "sit",
};

const ALL_FILES = Array.from(new Set(Object.values(POSE_FILE).filter(Boolean))) as string[];
const cache = new Map<string, object | null>();

async function loadCat(name: string): Promise<object | null> {
  if (cache.has(name)) return cache.get(name) ?? null;
  try {
    const res = await fetch(`/cat/${name}.json`);
    if (!res.ok) {
      cache.set(name, null);
      return null;
    }
    const data = (await res.json()) as object;
    cache.set(name, data);
    return data;
  } catch {
    cache.set(name, null);
    return null;
  }
}

export function preloadCatLotties(): void {
  void Promise.all(ALL_FILES.map((f) => loadCat(f)));
}

export function CatLottie({
  pose,
  facing,
  size,
}: {
  pose: CatPose;
  facing: "left" | "right";
  size: number;
}) {
  const ratio = CAT_DIM.w / CAT_DIM.h;
  const w = Math.round(size * ratio);

  const [pngOk, setPngOk] = useState(true);
  useEffect(() => {
    setPngOk(true);
  }, [pose]);

  if (pngOk) {
    return (
      <img
        key={`png-${pose}`}
        src={`/cat/${pose}.png`}
        onError={() => setPngOk(false)}
        alt=""
        draggable={false}
        style={{
          width: w,
          height: size,
          objectFit: "contain",
          objectPosition: "bottom center",
          transform: facing === "left" ? "scaleX(-1)" : undefined,
        }}
      />
    );
  }

  const name = POSE_FILE[pose];
  const [data, setData] = useState<object | null>(() => (name ? (cache.get(name) ?? null) : null));

  useEffect(() => {
    if (!name) {
      setData(null);
      return;
    }
    let active = true;
    void loadCat(name).then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, [name]);

  if (data) {
    return (
      <div
        style={{
          width: w,
          height: size,
          transform: facing === "left" ? "scaleX(-1)" : undefined,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <Lottie src={data} loop autoplay style={{ width: w, height: size }} />
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${CAT_DIM.w} ${CAT_DIM.h}`} width={w} height={size} style={{ overflow: "visible" }}>
      <g transform={facing === "left" ? `matrix(-1 0 0 1 ${CAT_DIM.w} 0)` : undefined}>
        <PoseArt pose={pose} />
      </g>
    </svg>
  );
}
