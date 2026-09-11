"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui";
import { Button } from "@/components/ui";
import type { CreatedUser } from "@/lib/admin/actions";

const ROLE_LABELS: Record<string, string> = {
  parent: "家长",
  teacher: "教师",
  classroom: "大屏",
  admin: "管理员",
};

interface TokenDisplayProps {
  created: CreatedUser | null;
  onClose: () => void;
}

export function TokenDisplay({ created, onClose }: TokenDisplayProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  function copy(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <Dialog open={!!created} onClose={onClose} title="用户创建成功" className="max-w-lg">
      {created && (
        <div className="space-y-4">
          <div className="rounded-md bg-success/10 p-3 text-copy-14 text-success ring-1 ring-success/30">
            Token 仅显示一次，请立即保存！
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-label-12 font-medium text-neutral-7">姓名</span>
              <span className="text-copy-14 text-neutral-10">
                {created.name}（{ROLE_LABELS[created.role]}）
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-label-12 font-medium text-neutral-7">登录 ID</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md bg-neutral-1 px-3 py-2 font-mono text-copy-13 text-neutral-9 ring-1 ring-border">
                  {created.username}
                </code>
                <Button
                  size="sm"
                  variant={copiedField === "username" ? "secondary" : "ghost"}
                  onClick={() => copy(created.username, "username")}
                >
                  {copiedField === "username" ? "已复制" : "复制"}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-label-12 font-medium text-neutral-7">Token</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-md bg-neutral-1 px-3 py-2 font-mono text-copy-13 text-neutral-9 ring-1 ring-border">
                  {created.token}
                </code>
                <Button
                  size="sm"
                  variant={copiedField === "token" ? "secondary" : "ghost"}
                  onClick={() => copy(created.token, "token")}
                >
                  {copiedField === "token" ? "已复制" : "复制"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
