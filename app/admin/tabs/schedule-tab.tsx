"use client";

import { useState, useTransition, useEffect } from "react";
import { Button, Card, useToast } from "@/components/ui";
import { getFullSchedule, saveSchedule } from "@/lib/schedule/actions";
import type { SubjectListItem, ClassListItem, UserListItem } from "@/lib/admin/actions";

const DAY_LABELS = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const PERIODS = Array.from({ length: 12 }, (_, i) => i + 1);

interface ScheduleTabProps {
  classes: ClassListItem[];
  subjects: SubjectListItem[];
  users: UserListItem[];
  onRefresh: () => Promise<void>;
}

type EntryDraft = {
  period: number;
  subjectId: string;
  teacherId: string;
  startTime: string;
  endTime: string;
};

export function ScheduleTab({ classes, subjects, users }: ScheduleTabProps) {
  const [pending, startTransition] = useTransition();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [drafts, setDrafts] = useState<EntryDraft[]>([]);
  const { show } = useToast();

  const teachers = users.filter((u) => u.role === "teacher");

  useEffect(() => {
    if (!selectedClass) return;
    let active = true;
    startTransition(async () => {
      try {
        const schedule = await getFullSchedule(selectedClass);
        if (!active) return;
        const dayEntries = schedule.filter((e) => e.dayOfWeek === selectedDay);
        setDrafts(
          PERIODS.map((period) => {
            const existing = dayEntries.find((e) => e.period === period);
            return existing
              ? { period, subjectId: existing.subjectId, teacherId: existing.teacherId, startTime: existing.startTime, endTime: existing.endTime }
              : { period, subjectId: "", teacherId: "", startTime: "", endTime: "" };
          }),
        );
      } catch {
        /* ignore */
      }
    });
    return () => {
      active = false;
    };
  }, [selectedClass, selectedDay]);

  function updateDraft(index: number, field: keyof EntryDraft, value: string) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  }

  function handleSave() {
    if (!selectedClass) return;
    startTransition(async () => {
      try {
        const entries = drafts
          .filter((d) => d.subjectId && d.teacherId && d.startTime && d.endTime)
          .map((d) => ({
            dayOfWeek: selectedDay,
            period: d.period,
            subjectId: d.subjectId,
            teacherId: d.teacherId,
            startTime: d.startTime,
            endTime: d.endTime,
          }));
        const result = await saveSchedule({ classId: selectedClass, dayOfWeek: selectedDay, entries });
        if (!result.ok) {
          show("error", result.error);
          return;
        }
        show("success", "课表已保存");
      } catch (err) {
        show("error", err instanceof Error ? err.message : "保存失败");
      }
    });
  }

  if (classes.length === 0) {
    return <p className="text-copy-14 text-neutral-6">请先创建班级</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-20 font-medium text-neutral-10">课表管理</h2>
        <Button onClick={handleSave} disabled={pending || !selectedClass}>
          {pending ? "保存中…" : "保存当天课表"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="rounded-lg border border-border bg-neutral-1 px-3 py-2 text-copy-14"
        >
          <option value="">选择班级</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`rounded-lg px-3 py-2 text-copy-14 ${selectedDay === day ? "bg-accent text-white" : "bg-neutral-2 text-neutral-7 hover:bg-neutral-3"}`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      {selectedClass && (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-copy-14">
              <thead>
                <tr className="border-b border-border text-label-12 text-neutral-7">
                  <th className="px-4 py-3 text-left font-medium">节次</th>
                  <th className="px-4 py-3 text-left font-medium">学科</th>
                  <th className="px-4 py-3 text-left font-medium">教师</th>
                  <th className="px-4 py-3 text-left font-medium">开始</th>
                  <th className="px-4 py-3 text-left font-medium">结束</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => (
                  <tr key={d.period} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-neutral-9">第 {d.period} 节</td>
                    <td className="px-4 py-2">
                      <select
                        value={d.subjectId}
                        onChange={(e) => updateDraft(i, "subjectId", e.target.value)}
                        className="w-full rounded-lg border border-border bg-neutral-1 px-2 py-1 text-copy-13"
                      >
                        <option value="">—</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={d.teacherId}
                        onChange={(e) => updateDraft(i, "teacherId", e.target.value)}
                        className="w-full rounded-lg border border-border bg-neutral-1 px-2 py-1 text-copy-13"
                      >
                        <option value="">—</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={d.startTime}
                        onChange={(e) => updateDraft(i, "startTime", e.target.value)}
                        className="rounded-lg border border-border bg-neutral-1 px-2 py-1 text-copy-13"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="time"
                        value={d.endTime}
                        onChange={(e) => updateDraft(i, "endTime", e.target.value)}
                        className="rounded-lg border border-border bg-neutral-1 px-2 py-1 text-copy-13"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
