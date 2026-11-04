"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useUrgentAudio(activeId?: string) {
  const contextRef = useRef<AudioContext | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");

  const unlock = useCallback(async () => {
    try {
      if (!contextRef.current) {
        const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) throw new Error("当前浏览器不支持 Web Audio 提示音");
        contextRef.current = new AudioContextConstructor();
      }
      await contextRef.current.resume();
      setUnlocked(contextRef.current.state === "running");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "提示音启用失败");
    }
  }, []);

  useEffect(() => {
    const handleInteraction = () => void unlock();
    window.addEventListener("pointerdown", handleInteraction, { once: true });
    window.addEventListener("keydown", handleInteraction, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [unlock]);

  useEffect(() => {
    if (!activeId || !unlocked || !contextRef.current) return;
    const context = contextRef.current;
    const ring = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, now);
      oscillator.frequency.setValueAtTime(880, now + 0.22);
      oscillator.frequency.setValueAtTime(660, now + 0.44);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.82);
      oscillator.addEventListener("ended", () => { oscillator.disconnect(); gain.disconnect(); }, { once: true });
    };
    ring();
    const interval = window.setInterval(ring, 900);
    return () => window.clearInterval(interval);
  }, [activeId, unlocked]);

  useEffect(() => () => { void contextRef.current?.close(); }, []);
  return { unlocked, unlock, error };
}
