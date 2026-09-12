"use client";

import { useState, useEffect } from "react";
import { getRecentAuditLogs, type AuditLogItem } from "@/lib/admin/audit";

const ACTION_LABELS: Record<string, string> = {
  create: "创建",
  delete: "删除",
  update: "更新",
  reset_token: "重置Token",
  bind: "绑定",
  unbind: "解绑",
  batch_create: "批量创建",
};

export function AuditTab() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getRecentAuditLogs(100).then((items) => {
      if (active) {
        setLogs(items);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-copy-14 text-neutral-6">加载中…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-title-24 font-medium text-neutral-10">审计日志</h2>
      {logs.length === 0 ? (
        <p className="text-copy-14 text-neutral-6">暂无操作记录</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-border">
          <table className="w-full text-left text-copy-13">
            <thead className="bg-neutral-2 text-label-12 text-neutral-6">
              <tr>
                <th className="px-4 py-2">操作者</th>
                <th className="px-4 py-2">操作</th>
                <th className="px-4 py-2">目标类型</th>
                <th className="px-4 py-2">目标ID</th>
                <th className="px-4 py-2">详情</th>
                <th className="px-4 py-2">时间</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-border">
                  <td className="px-4 py-2 text-neutral-9">{log.userName}</td>
                  <td className="px-4 py-2 text-neutral-7">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="px-4 py-2 text-neutral-7">{log.targetType}</td>
                  <td className="px-4 py-2 text-neutral-6">
                    {log.targetId ? log.targetId.slice(0, 8) + "…" : "-"}
                  </td>
                  <td className="px-4 py-2 text-neutral-6">
                    {log.detail ? JSON.stringify(log.detail).slice(0, 50) : "-"}
                  </td>
                  <td className="px-4 py-2 text-neutral-6">
                    {log.createdAt.toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
