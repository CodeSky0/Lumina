"use client";

import { useMemo } from "react";
import type { ScreenTeacher } from "@/lib/messages/queries";

export function TeacherSidebar({
  teachers,
  selectedKey,
  onSelect,
  className,
  unreadByTeacher,
  totalUnread,
}: {
  teachers: ScreenTeacher[];
  selectedKey: string;
  onSelect: (key: string) => void;
  className: string;
  unreadByTeacher: Map<string, number>;
  totalUnread: number;
}) {
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { subjectName: string; subjectSortOrder: number; teachers: ScreenTeacher[] }
    >();
    for (const t of teachers) {
      const existing = map.get(t.subjectId);
      if (existing) {
        existing.teachers.push(t);
      } else {
        map.set(t.subjectId, {
          subjectName: t.subjectName,
          subjectSortOrder: t.subjectSortOrder,
          teachers: [t],
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => a.subjectSortOrder - b.subjectSortOrder,
    );
  }, [teachers]);

  return (
    <div className="flex h-full flex-col bg-neutral-1">
      <div className="border-b border-border px-5 py-5">
        <h1 className="text-title-24 font-medium text-neutral-9">Lumina</h1>
        <p className="mt-1 text-copy-14 text-neutral-6">
          {className} · 教室大屏
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <button
          onClick={() => onSelect("all")}
          className={`mb-3 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition-colors ${
            selectedKey === "all"
              ? "bg-accent text-white"
              : "hover:bg-neutral-2"
          }`}
        >
          <span className="flex items-center gap-2 text-title-20 font-medium">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            全部消息
          </span>
          {totalUnread > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-label-12 ${
                selectedKey === "all"
                  ? "bg-white/20 text-white"
                  : "bg-error text-white"
              }`}
            >
              {totalUnread}
            </span>
          )}
        </button>

        {groups.map((group) => (
          <div key={group.subjectName} className="mb-2">
            <p className="px-3 py-1 text-title-20 font-medium text-neutral-7">
              {group.subjectName}
            </p>
            {group.teachers.map((t) => {
              const unread = unreadByTeacher.get(t.teacherId) ?? 0;
              const active = selectedKey === t.teacherId;
              return (
                <button
                  key={t.teacherId}
                  onClick={() => onSelect(t.teacherId)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-accent text-white" : "hover:bg-neutral-2"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-copy-16 font-medium">
                      {t.teacherName}
                    </span>
                    {t.isHeadTeacher && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-label-12 ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-accent/10 text-accent"
                        }`}
                      >
                        班主任
                      </span>
                    )}
                  </span>
                  {unread > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-label-12 ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-error text-white"
                      }`}
                    >
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {teachers.length === 0 && (
          <p className="px-3 py-4 text-copy-14 text-neutral-6">
            本班暂无任课教师
          </p>
        )}
      </div>
    </div>
  );
}
