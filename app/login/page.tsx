"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-1/4 -top-1/4 h-3/5 w-3/5 rounded-full bg-accent/20 blur-3xl animate-aurora" />
        <div className="absolute -bottom-1/4 -right-1/4 h-3/5 w-3/5 rounded-full bg-accent/10 blur-3xl animate-aurora-alt" />
        <div className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success/5 blur-3xl animate-float" />
      </div>

      <motion.form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm space-y-6 rounded-xl bg-neutral-2/80 p-8 ring-1 ring-border backdrop-blur-sm"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <div className="space-y-1">
          <h1 className="font-serif text-title-28 font-medium text-neutral-10">
            Lumina 流光
          </h1>
          <p className="text-copy-13 text-neutral-7">家校沟通平台</p>
          <div className="relative mt-2 h-px overflow-hidden bg-neutral-4/40">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent animate-shimmer" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="id" className="text-label-12 font-medium text-neutral-9">
            ID
          </label>
          <div className="group relative">
            <input
              id="id"
              name="id"
              autoComplete="username"
              required
              className="w-full rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none transition-all duration-fast ease-standard focus:ring-2 focus:ring-accent"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-accent to-accent/40 transition-transform duration-slow ease-out group-focus-within:scale-x-100" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="token" className="text-label-12 font-medium text-neutral-9">
            Token
          </label>
          <div className="group relative">
            <input
              id="token"
              name="token"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none transition-all duration-fast ease-standard focus:ring-2 focus:ring-accent"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-accent to-accent/40 transition-transform duration-slow ease-out group-focus-within:scale-x-100" />
          </div>
        </div>
        {error && (
          <motion.p
            className="text-copy-13 text-error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {error}
          </motion.p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="relative w-full overflow-hidden rounded-md bg-accent py-2.5 text-copy-14 font-medium text-white transition-all duration-fast ease-standard hover:opacity-90 disabled:opacity-50"
        >
          <span className="relative z-10">{loading ? "登录中…" : "登录"}</span>
          {!loading && (
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          )}
        </button>
      </motion.form>
    </main>
  );
}
