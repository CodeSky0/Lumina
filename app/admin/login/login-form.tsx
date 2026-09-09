"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { createFirstAdmin } from "@/lib/admin/actions";

/**
 * 管理端登录/注册双模式。
 * - hasAdmin=false（首次）：注册首个管理员表单，创建后自动登录。
 * - hasAdmin=true：正常 ID + Token 登录。
 */
export default function AdminLoginForm({ hasAdmin }: { hasAdmin: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();
  const [createdId, setCreatedId] = useState<string | null>(null);

  if (!hasAdmin) {
    async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setError(null);
      setCreatedId(null);
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "");
      const token = String(form.get("token") ?? "");
      const confirm = String(form.get("confirm") ?? "");
      if (token !== confirm) {
        setError("两次输入的 Token 不一致");
        return;
      }
      startTransition(async () => {
        const res = await createFirstAdmin({ name, token });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setCreatedId(res.username);
        const signIn = await authClient.signIn.username({
          username: res.username,
          password: token,
        });
        if (signIn.error) {
          setError("管理员已创建，但自动登录失败，请用下方 ID 手动登录");
          return;
        }
        router.push("/admin");
      });
    }

    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <form
          onSubmit={handleRegister}
          className="w-full max-w-sm space-y-6 rounded-xl bg-neutral-2 p-8 ring-1 ring-border"
        >
          <div className="space-y-1">
            <h1 className="font-serif text-title-28 font-medium text-neutral-10">
              初始化管理员
            </h1>
            <p className="text-copy-13 text-neutral-7">
              首次使用 — 创建首个管理员账户
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-label-12 font-medium text-neutral-9">
              姓名
            </label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="token" className="text-label-12 font-medium text-neutral-9">
              设置 Token（至少 8 位）
            </label>
            <input
              id="token"
              name="token"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-label-12 font-medium text-neutral-9">
              确认 Token
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {error && <p className="text-copy-13 text-error">{error}</p>}
          {createdId && (
            <p className="break-all text-label-12 text-neutral-7">
              登录 ID：<code className="text-copy-13 text-neutral-9">{createdId}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(createdId)}
                className="ml-1 text-accent underline"
              >
                复制
              </button>
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent py-2.5 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "创建中…" : "创建并登录"}
          </button>
        </form>
      </main>
    );
  }

  // 正常登录
  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const username = String(form.get("id") ?? "");
    const password = String(form.get("token") ?? "");
    startTransition(async () => {
      try {
        const result = await authClient.signIn.username({ username, password });
        if (result.error) {
          setError(result.error.message ?? "ID 或 Token 错误");
          return;
        }
        router.push("/admin");
      } catch {
        setError("登录失败，请重试");
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-6 rounded-xl bg-neutral-2 p-8 ring-1 ring-border"
      >
        <div className="space-y-1">
          <h1 className="font-serif text-title-28 font-medium text-neutral-10">
            管理端登录
          </h1>
          <p className="text-copy-13 text-neutral-7">Lumina · 仅限管理员</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="id" className="text-label-12 font-medium text-neutral-9">
            ID
          </label>
          <input
            id="id"
            name="id"
            autoComplete="username"
            required
            className="w-full rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="token" className="text-label-12 font-medium text-neutral-9">
            Token
          </label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        {error && <p className="text-copy-13 text-error">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent py-2.5 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
