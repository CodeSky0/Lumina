"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const form = new FormData(event.currentTarget);
      const username = String(form.get("id") ?? "");
      const password = String(form.get("token") ?? "");
      if (!username || !password) {
        setError("请输入 ID 和 Token");
        return;
      }
      const result = await authClient.signIn.username({ username, password });
      if (result.error) {
        setError(result.error.message ?? "ID 或 Token 错误");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 rounded-xl bg-neutral-2 p-8 ring-1 ring-border"
      >
        <div className="space-y-1">
          <h1 className="font-serif text-title-28 font-medium text-neutral-10">
            Lumina 流光
          </h1>
          <p className="text-copy-13 text-neutral-7">家校沟通平台</p>
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
