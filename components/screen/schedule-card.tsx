"use client";

import { useEffect, useState } from "react";
import type { ScheduleEntry } from "@/lib/schedule/queries";

export function ScheduleCard({
  current: initialCurrent,
  next: initialNext,
}: {
  current: ScheduleEntry | null;
  next: ScheduleEntry | null;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!initialCurrent && !initialNext) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-neutral-2 px-4 py-2">
        <span className="text-copy-14 text-neutral-6">今日无课</span>
      </div>
    );
  }

  const active = initialCurrent ?? initialNext;
  if (!active) return null;

  const isCurrent = !!initialCurrent;
  const [eh, em] = active.endTime.split(":").map(Number);
  const endMinutes = (eh ?? 0) * 60 + (em ?? 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const remaining = Math.max(0, endMinutes - nowMinutes);
  const remainMin = Math.floor(remaining);
  const remainSec = Math.floor((remaining - remainMin) * 60);

  return (
    <div className={`flex items-center gap-3 rounded-lg px-4 py-2 ${isCurrent ? "bg-accent/10" : "bg-neutral-2"}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isCurrent ? "bg-accent text-white" : "bg-neutral-3 text-neutral-7"}`}>
        <span className="text-label-12 font-medium">{isCurrent ? "正在" : "下节"}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-copy-14 font-medium text-neutral-10">
          {active.subjectName} · {active.teacherName}
        </span>
        <span className="text-caption-10 text-neutral-6">
          {active.startTime} - {active.endTime}
          {isCurrent && ` · 剩余 ${remainMin}:${String(remainSec).padStart(2, "0")}`}
        </span>
      </div>
    </div>
  );
}
