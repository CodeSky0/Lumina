"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Select,
  useToast,
} from "@/components/ui";
import {
  createUser,
  deleteUser,
  resetUserToken,
  type BatchResultItem,
  type ClassListItem,
  type CreatedUser,
  type UserListItem,
} from "@/lib/admin/actions";
import { TokenDisplay } from "../components/token-display";
import { ConfirmDialog } from "../components/confirm-dialog";
import { BatchImportDialog } from "../components/batch-import-dialog";
import { BatchResultDialog } from "../components/batch-result-dialog";

const ROLE_LABELS: Record<string, string> = {
  parent: "家长",
  teacher: "教师",
  classroom: "大屏",
  admin: "管理员",
};

const ROLE_BADGE_TONE: Record<string, "neutral" | "accent" | "success" | "error"> = {
  parent: "neutral",
  teacher: "accent",
  classroom: "success",
  admin: "error",
};

interface UsersTabProps {
  users: UserListItem[];
  classes: ClassListItem[];
  onRefresh: () => Promise<void>;
}

export function UsersTab({ users, onRefresh }: UsersTabProps) {
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [tokenMode, setTokenMode] = useState<"create" | "reset">("create");
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchMode, setBatchMode] = useState<"teacher" | "student">("teacher");
  const [batchResults, setBatchResults] = useState<BatchResultItem[] | null>(null);
  const { show } = useToast();

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await createUser({
          role: String(f.get("role")) as CreatedUser["role"],
          name: String(f.get("name")),
        });
        setCreated(res);
        setTokenMode("create");
        setShowCreate(false);
        await onRefresh();
        show("success", "用户创建成功");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteUser(deleteTarget.id);
        setDeleteTarget(null);
        await onRefresh();
        show("success", "用户已删除");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  function handleResetToken(user: UserListItem) {
    startTransition(async () => {
      try {
        const res = await resetUserToken(user.id);
        setTokenMode("reset");
        setCreated(res);
        show("success", "Token 已重置");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "重置失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-20 font-medium text-neutral-10">
          用户管理（{users.length}）
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setBatchMode("teacher");
              setShowBatchImport(true);
            }}
          >
            批量导入教师
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setBatchMode("student");
              setShowBatchImport(true);
            }}
          >
            批量导入学生
          </Button>
          <Button onClick={() => setShowCreate(true)}>创建用户</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="搜索姓名或 ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select
          placeholder="全部角色"
          options={[
            { value: "parent", label: "家长" },
            { value: "teacher", label: "教师" },
            { value: "classroom", label: "大屏" },
            { value: "admin", label: "管理员" },
          ]}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-32"
        />
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-copy-14">
            <thead>
              <tr className="border-b border-border text-label-12 text-neutral-7">
                <th className="px-4 py-3 text-left font-medium">姓名</th>
                <th className="px-4 py-3 text-left font-medium">角色</th>
                <th className="px-4 py-3 text-left font-medium">登录 ID</th>
                <th className="px-4 py-3 text-left font-medium">创建时间</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-6">
                    无匹配用户
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-neutral-3/50"
                >
                  <td className="px-4 py-3 text-neutral-10">{u.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_BADGE_TONE[u.role]}>
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-label-12 text-neutral-7">
                      {u.username.slice(0, 8)}…
                    </code>
                  </td>
                  <td className="px-4 py-3 text-label-12 text-neutral-7">
                    {u.createdAt.toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetToken(u)}
                      >
                        重置Token
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleteTarget(u)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="创建用户">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            name="role"
            label="角色"
            placeholder="选择角色"
            options={[
              { value: "parent", label: "家长" },
              { value: "teacher", label: "教师" },
              { value: "classroom", label: "大屏" },
              { value: "admin", label: "管理员" },
            ]}
            required
          />
          <Input name="name" label="姓名" required />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "创建中…" : "创建"}
            </Button>
          </div>
        </form>
      </Dialog>

      <TokenDisplay created={created} onClose={() => setCreated(null)} mode={tokenMode} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除用户"
        message={`确认删除 ${deleteTarget?.name}（${deleteTarget ? ROLE_LABELS[deleteTarget.role] : ""}）？此操作不可撤销。`}
        confirmLabel="删除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <BatchImportDialog
        open={showBatchImport}
        mode={batchMode}
        onClose={() => setShowBatchImport(false)}
        onComplete={(results) => {
          setShowBatchImport(false);
          setBatchResults(results);
          onRefresh();
        }}
      />

      <BatchResultDialog
        results={batchResults}
        onClose={() => setBatchResults(null)}
      />
    </div>
  );
}
