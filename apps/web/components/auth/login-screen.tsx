"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleNotch, DeviceMobile, Eye, EyeSlash, LockKey, User as UserIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/ui/brand";
import { InlineError } from "@/components/ui/async-state";
import { useAuth } from "@/lib/auth";
import { destinationForRole } from "@/lib/auth-utils";
import { useSessionStore } from "@/stores/session";
import { cn } from "@/lib/utils";

export function LoginScreen() {
  const router = useRouter();
  const { login, deviceLogin } = useAuth();
  const user = useSessionStore((state) => state.user);
  const status = useSessionStore((state) => state.status);
  const [mode, setMode] = useState<"account" | "device">("account");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(destinationForRole(user.role));
  }, [router, status, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const destination = mode === "account" ? await login(username.trim(), password) : await deviceLogin(code.trim());
      router.replace(destination);
    } catch (reason) {
      setError(reason);
    } finally {
      setIsPending(false);
    }
  }

  function switchMode(next: "account" | "device") {
    setMode(next);
    setError(null);
  }

  return (
    <main id="main-content" className="grid min-h-[100dvh] bg-paper lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-neutral-2 p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <Brand />
        <div className="relative max-w-xl">
          <div className="absolute -left-14 top-3 h-px w-10 bg-accent" aria-hidden="true" />
          <p className="y-meta mb-5 text-label-12 uppercase tracking-[0.24em] text-neutral-6">校园沟通，从找到彼此开始</p>
          <h1 className="text-display-36 font-medium leading-[1.12] tracking-[-0.02em] text-neutral-10 xl:text-display-48">让每一条消息，<br /><span className="text-neutral-6">抵达正确的教室。</span></h1>
          <p className="mt-7 max-w-md text-copy-16 leading-8 text-neutral-7">按班级与科目组织会话，让教师少跑一次楼道，让重要通知被及时看见。</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border/60">
          <div className="bg-neutral-2 p-5"><p className="y-meta text-copy-13 text-neutral-6">教学通道</p><p className="mt-2 font-medium text-neutral-9">每位教师固定一个科目</p></div>
          <div className="bg-neutral-2 p-5"><p className="y-meta text-copy-13 text-neutral-6">紧急通知</p><p className="mt-2 font-medium text-neutral-9">教室确认后才解除提醒</p></div>
        </div>
        <div className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rotate-12 rounded-[5rem] border border-border" aria-hidden="true" />
      </section>

      <section className="flex min-h-[100dvh] flex-col bg-paper px-6 py-7 sm:px-12 lg:px-16 xl:px-24">
        <div className="lg:hidden"><Brand /></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          {status === "restoring" ? (
            <div className="flex items-center gap-3 text-copy-14 text-neutral-7" role="status"><CircleNotch className="h-5 w-5 animate-spin text-accent" />正在安全恢复会话</div>
          ) : (
            <>
              <div className="mb-8">
                <p className="mb-3 text-label-12 font-medium uppercase tracking-[1.5px] text-neutral-6">统一身份入口</p>
                <h2 className="text-title-28 font-medium tracking-tight text-neutral-10">欢迎回来</h2>
                <p className="mt-3 text-copy-14 leading-6 text-neutral-7">使用校园账号登录，教室设备可切换绑定码登录。</p>
              </div>
              <div className="mb-7 grid grid-cols-2 rounded-md bg-neutral-2 p-1" role="tablist" aria-label="登录方式">
                <button role="tab" aria-selected={mode === "account"} onClick={() => switchMode("account")} className={cn("flex min-h-10 items-center justify-center gap-2 rounded-md text-copy-14 font-medium transition", mode === "account" ? "bg-paper text-neutral-10 ring-1 ring-border" : "text-neutral-7 hover:text-neutral-10")}><UserIcon className="h-4 w-4" />账号登录</button>
                <button role="tab" aria-selected={mode === "device"} onClick={() => switchMode("device")} className={cn("flex min-h-10 items-center justify-center gap-2 rounded-md text-copy-14 font-medium transition", mode === "device" ? "bg-paper text-neutral-10 ring-1 ring-border" : "text-neutral-7 hover:text-neutral-10")}><DeviceMobile className="h-4 w-4" />设备登录</button>
              </div>
              <form className="space-y-5" onSubmit={submit}>
                {mode === "account" ? (
                  <>
                    <div className="space-y-2"><Label htmlFor="username">用户名</Label><div className="relative"><UserIcon className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-6" /><Input id="username" className="pl-10" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={80} placeholder="请输入校园账号" /></div></div>
                    <div className="space-y-2"><Label htmlFor="password">密码</Label><div className="relative"><LockKey className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-6" /><Input id="password" className="px-10" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={128} placeholder="请输入密码" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-neutral-6 hover:bg-neutral-2 hover:text-neutral-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                  </>
                ) : (
                  <div className="space-y-2"><Label htmlFor="device-code">设备绑定码</Label><Input id="device-code" type="password" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={256} placeholder="请输入管理员提供的绑定码" /><p className="text-label-12 leading-5 text-neutral-6">绑定码由学校管理员管理，兑换后仅保存安全会话。</p></div>
                )}
                <InlineError error={error} />
                <Button type="submit" size="lg" className="w-full" isLoading={isPending} disabled={mode === "account" ? !username.trim() || !password : !code.trim()}>{isPending ? "正在验证身份" : "进入工作区"}<ArrowRight className="h-4 w-4" /></Button>
              </form>
              <p className="mt-6 text-label-12 leading-5 text-neutral-6">连续登录失败可能触发临时锁定。若无法登录，请联系学校管理员。</p>
            </>
          )}
        </div>
        <p className="y-meta text-center text-label-12 text-neutral-6 lg:text-left">Lumina · 校园内部通讯系统</p>
      </section>
    </main>
  );
}