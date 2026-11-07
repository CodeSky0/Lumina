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

  const tabs: Array<{ value: "account" | "device"; label: string; icon: typeof UserIcon }> = [
    { value: "account", label: "账号登录", icon: UserIcon },
    { value: "device", label: "设备登录", icon: DeviceMobile },
  ];

  return (
    <main id="main-content" className="grid min-h-[100dvh] bg-paper lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-neutral-2 p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="ambient-blob animate-drift -left-24 -top-20 h-72 w-72 bg-accent/30" />
          <div className="ambient-blob animate-drift -right-16 top-1/3 h-64 w-64 bg-info/25" style={{ animationDelay: "-9s" }} />
          <div className="ambient-blob animate-float bottom-0 left-1/4 h-56 w-56 bg-accent/20" />
          <div className="orbit-ring absolute -right-24 top-1/3 h-80 w-80 rounded-[5rem] border border-border" />
        </div>
        <div className="relative animate-rise"><Brand /></div>
        <div className="relative max-w-xl">
          <div className="absolute -left-14 top-3 h-px w-10 origin-right bg-accent animate-rise" style={{ animationDelay: "140ms" }} aria-hidden="true" />
          <p className="y-meta mb-5 text-label-12 uppercase tracking-[0.24em] text-neutral-6 animate-rise" style={{ animationDelay: "180ms" }}>校园沟通，从找到彼此开始</p>
          <h1 className="text-display-36 font-medium leading-[1.12] tracking-[-0.02em] text-neutral-10 animate-rise xl:text-display-48" style={{ animationDelay: "250ms" }}>让每一条消息，<br /><span className="text-neutral-6">抵达正确的教室。</span></h1>
          <p className="mt-7 max-w-md text-copy-16 leading-8 text-neutral-7 animate-rise" style={{ animationDelay: "330ms" }}>按班级与科目组织会话，让教师少跑一次楼道，让重要通知被及时看见。</p>
        </div>
        <div className="relative grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border/60 animate-rise" style={{ animationDelay: "420ms" }}>
          <div className="bg-neutral-2 p-5"><p className="y-meta text-copy-13 text-neutral-6">教学通道</p><p className="mt-2 font-medium text-neutral-9">每位教师固定一个科目</p></div>
          <div className="bg-neutral-2 p-5"><p className="y-meta text-copy-13 text-neutral-6">紧急通知</p><p className="mt-2 font-medium text-neutral-9">教室确认后才解除提醒</p></div>
        </div>
      </section>

      <section className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-paper px-6 py-7 sm:px-12 lg:px-16 xl:px-24">
        <div className="pointer-events-none absolute -right-28 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl lg:hidden" aria-hidden="true" />
        <div className="relative lg:hidden"><Brand /></div>
        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          {status === "restoring" ? (
            <div className="flex items-center gap-3 text-copy-14 text-neutral-7 animate-fadeIn" role="status"><CircleNotch className="h-5 w-5 animate-spin text-accent" />正在安全恢复会话</div>
          ) : (
            <>
              <div className="mb-8 animate-rise">
                <p className="mb-3 flex items-center gap-2 text-label-12 font-medium uppercase tracking-[1.5px] text-neutral-6"><span className="h-px w-6 bg-accent/70" aria-hidden="true" />统一身份入口</p>
                <h2 className="text-title-28 font-medium tracking-tight text-neutral-10">欢迎回来</h2>
                <p className="mt-3 text-copy-14 leading-6 text-neutral-7">使用校园账号登录，教室设备可切换绑定码登录。</p>
              </div>
              <div className="relative mb-7 grid grid-cols-2 rounded-md bg-neutral-2 p-1 animate-rise" style={{ animationDelay: "90ms" }} role="tablist" aria-label="登录方式">
                <span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-paper shadow-whisper ring-1 ring-border transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", mode === "device" && "translate-x-full")} />
                {tabs.map((tab) => (
                  <button key={tab.value} role="tab" aria-selected={mode === tab.value} onClick={() => switchMode(tab.value)} className={cn("relative z-10 flex min-h-10 items-center justify-center gap-2 rounded-md text-copy-14 font-medium transition-colors duration-200", mode === tab.value ? "text-neutral-10" : "text-neutral-7 hover:text-neutral-10")}><tab.icon className="h-4 w-4" />{tab.label}</button>
                ))}
              </div>
              <form className="space-y-5" onSubmit={submit}>
                <div key={mode} className="space-y-5 animate-rise">
                  {mode === "account" ? (
                    <>
                      <div className="space-y-2"><Label htmlFor="username">用户名</Label><div className="relative"><UserIcon className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-6" /><Input id="username" className="pl-10" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={80} placeholder="请输入校园账号" /></div></div>
                      <div className="space-y-2"><Label htmlFor="password">密码</Label><div className="relative"><LockKey className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-6" /><Input id="password" className="px-10" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={128} placeholder="请输入密码" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-neutral-6 transition-colors duration-200 hover:bg-neutral-2 hover:text-neutral-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                    </>
                  ) : (
                    <div className="space-y-2"><Label htmlFor="device-code">设备绑定码</Label><Input id="device-code" type="password" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={256} placeholder="请输入管理员提供的绑定码" /><p className="text-label-12 leading-5 text-neutral-6">绑定码由学校管理员管理，兑换后仅保存安全会话。</p></div>
                  )}
                </div>
                <InlineError error={error} />
                <Button type="submit" size="lg" className="w-full" isLoading={isPending} disabled={mode === "account" ? !username.trim() || !password : !code.trim()}>{isPending ? "正在验证身份" : "进入工作区"}<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" /></Button>
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