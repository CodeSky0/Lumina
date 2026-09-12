"use client";

import { useState, useEffect, useTransition } from "react";
import { getDashboardStats, type DashboardStats } from "@/lib/admin/stats";
import { exportUsersCSV, exportBindingsCSV, exportMessagesCSV } from "@/lib/admin/export";

const ROLE_LABELS: Record<string, string> = {
  parent: "家长",
  teacher: "教师",
  classroom: "大屏",
  admin: "管理员",
};

export function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void getDashboardStats().then((s) => {
      if (active) {
        setStats(s);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExport(type: "users" | "bindings" | "messages") {
    startTransition(async () => {
      const fn = type === "users" ? exportUsersCSV : type === "bindings" ? exportBindingsCSV : exportMessagesCSV;
      const csv = await fn();
      if (csv) {
        downloadCSV(csv, `lumina-${type}-${new Date().toISOString().slice(0, 10)}.csv`);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-copy-14 text-neutral-6">加载中…</p>
      </div>
    );
  }

  if (!stats) return null;

  const maxDayCount = Math.max(...stats.messagesByDay.map((d) => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-24 font-medium text-neutral-10">仪表盘</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("users")}
            disabled={exporting}
            className="rounded-lg bg-neutral-2 px-3 py-1.5 text-copy-13 text-neutral-7 ring-1 ring-border transition-colors hover:bg-neutral-3 disabled:opacity-50"
          >
            导出用户
          </button>
          <button
            onClick={() => handleExport("bindings")}
            disabled={exporting}
            className="rounded-lg bg-neutral-2 px-3 py-1.5 text-copy-13 text-neutral-7 ring-1 ring-border transition-colors hover:bg-neutral-3 disabled:opacity-50"
          >
            导出绑定
          </button>
          <button
            onClick={() => handleExport("messages")}
            disabled={exporting}
            className="rounded-lg bg-neutral-2 px-3 py-1.5 text-copy-13 text-neutral-7 ring-1 ring-border transition-colors hover:bg-neutral-3 disabled:opacity-50"
          >
            导出消息
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.userCounts.map((uc) => (
          <div key={uc.role} className="rounded-xl bg-neutral-2 p-4 ring-1 ring-border">
            <p className="text-label-12 text-neutral-6">{ROLE_LABELS[uc.role] ?? uc.role}</p>
            <p className="mt-1 font-serif text-title-32 font-medium text-neutral-10">{uc.count}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="班级总数" value={stats.totalClasses} />
        <StatCard label="消息总数" value={stats.totalMessages} />
        <StatCard label="会话总数" value={stats.totalConversations} />
        <StatCard label="公告总数" value={stats.totalAnnouncements} />
      </div>

      <div>
        <h3 className="mb-3 font-serif text-title-20 font-medium text-neutral-10">近 7 日消息趋势</h3>
        <div className="flex items-end gap-2 rounded-xl bg-neutral-2 p-4 ring-1 ring-border">
          {stats.messagesByDay.length === 0 ? (
            <p className="text-copy-13 text-neutral-6">暂无数据</p>
          ) : (
            stats.messagesByDay.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-accent transition-all"
                  style={{ height: `${(d.count / maxDayCount) * 120}px` }}
                />
                <span className="text-caption-10 text-neutral-6">{d.date.slice(5)}</span>
                <span className="text-caption-10 text-neutral-7">{d.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-serif text-title-20 font-medium text-neutral-10">最近注册用户</h3>
        <div className="overflow-hidden rounded-xl ring-1 ring-border">
          <table className="w-full text-left text-copy-13">
            <thead className="bg-neutral-2 text-label-12 text-neutral-6">
              <tr>
                <th className="px-4 py-2">姓名</th>
                <th className="px-4 py-2">角色</th>
                <th className="px-4 py-2">注册时间</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentUsers.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2 text-neutral-9">{u.name}</td>
                  <td className="px-4 py-2 text-neutral-7">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="px-4 py-2 text-neutral-6">
                    {u.createdAt.toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-neutral-2 p-4 ring-1 ring-border">
      <p className="text-label-12 text-neutral-6">{label}</p>
      <p className="mt-1 font-serif text-title-32 font-medium text-neutral-10">{value}</p>
    </div>
  );
}
