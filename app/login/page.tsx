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
        className="w-full max-w-sm space-y-5 rounded-xl border border-gray-200 p-8 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-bold">Lumina 流光</h1>
          <p className="mt-1 text-sm text-gray-600">家校沟通平台</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="id" className="text-sm font-medium">
            ID
          </label>
          <input
            id="id"
            name="id"
            autoComplete="username"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="token" className="text-sm font-medium">
            Token
          </label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black py-2.5 text-white disabled:opacity-50"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
