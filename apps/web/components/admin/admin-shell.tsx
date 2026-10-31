"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChalkboardTeacher, ChatsCircle, ClipboardText, Gauge, List, Megaphone, Scroll, SignOut, SlidersHorizontal, UsersThree, X } from "@phosphor-icons/react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { useAuth } from "@/lib/auth";
import { useSessionStore } from "@/stores/session";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/admin", label: "工作概览", icon: Gauge },
  { href: "/admin/classes", label: "班级管理", icon: UsersThree },
  { href: "/admin/teachers", label: "教师管理", icon: ChalkboardTeacher },
  { href: "/admin/subjects", label: "科目管理", icon: BookOpen },
  { href: "/admin/channels", label: "通道管理", icon: ChatsCircle },
  { href: "/admin/assignments", label: "任务分配", icon: ClipboardText },
  { href: "/admin/announcements", label: "公告发布", icon: Megaphone },
  { href: "/admin/audit-logs", label: "审计日志", icon: Scroll },
  { href: "/admin/settings", label: "系统设置", icon: SlidersHorizontal },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav className="space-y-1" aria-label="管理端导航">{navigation.map((item) => {
    const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-400", active ? "bg-indigo-500 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white")}><item.icon className="h-5 w-5" weight={active ? "fill" : "regular"} />{item.label}</Link>;
  })}</nav>;
}

function AdminFrame({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const user = useSessionStore((state) => state.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-[100dvh] bg-[#f5f6f8] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-sidebar p-5 lg:flex">
        <div className="px-2 pb-8 pt-1"><Brand dark /></div><Navigation />
        <div className="mt-auto space-y-4 border-t border-white/10 px-2 pt-5"><ConnectionIndicator dark /><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{user?.display_name}</p><p className="text-xs text-zinc-500">系统管理员</p></div><Button variant="dark" size="icon" onClick={() => void logout()} aria-label="退出登录"><SignOut className="h-4 w-4" /></Button></div></div>
      </aside>
      <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-white/10 bg-sidebar px-4 text-white lg:hidden"><Button variant="dark" size="icon" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen} aria-label={mobileOpen ? "关闭导航" : "打开导航"}>{mobileOpen ? <X className="h-5 w-5" /> : <List className="h-5 w-5" />}</Button><Brand dark /><div className="ml-auto"><ConnectionIndicator dark /></div></header>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden"><button className="absolute inset-0 bg-zinc-950/50" onClick={() => setMobileOpen(false)} aria-label="关闭导航遮罩" /><aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar p-5 shadow-dialog animate-enter"><div className="mb-8 flex items-center justify-between"><Brand dark /><Button variant="dark" size="icon" onClick={() => setMobileOpen(false)} aria-label="关闭导航"><X className="h-5 w-5" /></Button></div><Navigation onNavigate={() => setMobileOpen(false)} /><Button className="mt-8 w-full" variant="dark" onClick={() => void logout()}><SignOut className="h-4 w-4" />退出登录</Button></aside></div>}
      <main id="main-content" className="min-w-0 px-4 py-6 sm:px-7 sm:py-8 lg:col-start-2 xl:px-10"><div className="mx-auto max-w-[1500px]">{children}</div></main>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) { return <AuthGuard role="admin"><AdminFrame>{children}</AdminFrame></AuthGuard>; }
