"use client";

import { useState } from "react";
import { Dialog, Button } from "@/components/ui";
import type { BatchResultItem } from "@/lib/admin/actions";

const ROLE_LABELS: Record<string, string> = {
  parent: "家长",
  teacher: "教师",
  classroom: "大屏",
  admin: "管理员",
};

interface BatchResultDialogProps {
  results: BatchResultItem[] | null;
  onClose: () => void;
}

function downloadCSV(results: BatchResultItem[]) {
  const headers = ["姓名", "角色", "登录ID", "Token", "班级", "学生姓名", "状态"];
  const rows = results.map((r) => [
    r.name,
    ROLE_LABELS[r.role] ?? r.role,
    r.username,
    r.token,
    r.className ?? "",
    r.studentName ?? "",
    r.error ?? "成功",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lumina-users.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function BatchResultDialog({ results, onClose }: BatchResultDialogProps) {
  const [copied, setCopied] = useState(false);

  function copyAll() {
    const lines = results!
      .filter((r) => !r.error)
      .map((r) => `${r.name}\t${ROLE_LABELS[r.role]}\t${r.username}\t${r.token}`);
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const successCount = results?.filter((r) => !r.error).length ?? 0;
  const errorCount = results?.filter((r) => r.error).length ?? 0;

  return (
    <Dialog
      open={!!results}
      onClose={onClose}
      title="导入结果"
      className="max-w-3xl"
    >
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3 text-copy-14">
              <span className="text-success">成功 {successCount}</span>
              {errorCount > 0 && <span className="text-error">失败 {errorCount}</span>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={copyAll}>
                {copied ? "已复制" : "复制全部"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => downloadCSV(results)}>
                下载 CSV
              </Button>
            </div>
          </div>

          <div className="max-h-[400px] overflow-auto rounded-md ring-1 ring-border">
            <table className="w-full text-copy-13">
              <thead className="sticky top-0 bg-neutral-2">
                <tr className="text-label-12 text-neutral-7">
                  <th className="px-3 py-2 text-left font-medium">姓名</th>
                  <th className="px-3 py-2 text-left font-medium">角色</th>
                  <th className="px-3 py-2 text-left font-medium">登录ID</th>
                  <th className="px-3 py-2 text-left font-medium">Token</th>
                  <th className="px-3 py-2 text-left font-medium">班级</th>
                  <th className="px-3 py-2 text-left font-medium">学生</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-border hover:bg-neutral-3/50"
                  >
                    <td className="px-3 py-2 text-neutral-10">{r.name}</td>
                    <td className="px-3 py-2 text-neutral-7">
                      {ROLE_LABELS[r.role] ?? r.role}
                    </td>
                    <td className="px-3 py-2">
                      <code className="font-mono text-neutral-9">
                        {r.username || "-"}
                      </code>
                    </td>
                    <td className="px-3 py-2">
                      <code className="font-mono text-neutral-9">
                        {r.token || "-"}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-neutral-7">
                      {r.className || "-"}
                    </td>
                    <td className="px-3 py-2 text-neutral-7">
                      {r.studentName || "-"}
                    </td>
                    <td className="px-3 py-2">
                      {r.error ? (
                        <span className="text-error">{r.error}</span>
                      ) : (
                        <span className="text-success">成功</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
