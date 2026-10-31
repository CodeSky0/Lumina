"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardText, Megaphone } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { readableKey } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/async-state";

export function Dashboard() {
  const query = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => apiFetch<Record<string, unknown>>("/api/v1/admin/dashboard") });
  const metrics = Object.entries(query.data ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === "number");
  return <>
    <PageHeader eyebrow="Lumina Console" title="校园通讯概览" description="实时汇总来自服务端的班级、教师、通道和在线状态数据。" />
    {query.isPending ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36" />)}</div> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : metrics.length === 0 ? <EmptyState title="暂无概览指标" description="服务端尚未返回可展示的统计数据，资源管理功能仍可正常使用。" /> : <section aria-label="校园通讯指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([key, value], index) => <article key={key} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-panel animate-enter" style={{ animationDelay: `${index * 45}ms` }}><p className="text-sm font-medium text-zinc-500">{readableKey(key)}</p><p className="mt-5 font-mono text-4xl font-semibold tracking-tight text-zinc-950">{new Intl.NumberFormat("zh-CN").format(value)}</p><div className="mt-4 h-1 w-8 rounded-full bg-indigo-500" /></article>)}</section>}
    <section className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_.75fr]" aria-labelledby="quick-actions"><div className="rounded-2xl border border-zinc-200 bg-white p-6"><h2 id="quick-actions" className="text-lg font-semibold">常用管理工作</h2><p className="mt-2 text-sm leading-6 text-zinc-500">教学任务保存后，由服务端事务自动建立对应科目通道。</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/admin/assignments" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white hover:bg-indigo-600"><ClipboardText className="h-4 w-4" />分配教学任务<ArrowRight className="h-4 w-4" /></Link><Link href="/admin/announcements" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"><Megaphone className="h-4 w-4" />发布校园公告</Link></div></div><div className="rounded-2xl bg-sidebar p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">数据边界</p><h2 className="mt-4 text-xl font-semibold">服务端是唯一事实来源</h2><p className="mt-3 text-sm leading-7 text-zinc-400">资源变更后自动刷新查询；实时事件只负责提醒同步，消息持久化结果以 Go API 返回为准。</p></div></section>
  </>;
}
