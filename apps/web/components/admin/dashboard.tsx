"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardText, Megaphone } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { readableKey } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState, ErrorState } from "@/components/ui/async-state";

export function Dashboard() {
  const query = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => apiFetch<Record<string, unknown>>("/api/v1/admin/dashboard") });
  const metrics = Object.entries(query.data ?? {}).filter((entry): entry is [string, number] => typeof entry[1] === "number");
  return <>
    <PageHeader eyebrow="Lumina Console" title="校园通讯概览" description="实时汇总来自服务端的班级、教师、通道和在线状态数据。" />
    {query.isPending ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36" />)}</div> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : metrics.length === 0 ? <EmptyState title="暂无概览指标" description="服务端尚未返回可展示的统计数据，资源管理功能仍可正常使用。" /> : <section aria-label="校园通讯指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([key, value], index) => <article key={key} className="lift sheen group relative overflow-hidden rounded-lg border border-border bg-neutral-2 p-5 animate-rise" style={{ animationDelay: `${index * 70}ms` }}><p className="y-meta text-copy-13 text-neutral-6">{readableKey(key)}</p><p className="mt-5 font-serif text-display-36 font-medium tabular-nums tracking-tight text-neutral-10"><AnimatedNumber value={value} /></p><div className="hairline mt-4 h-px w-8 bg-accent" /></article>)}</section>}
    <section className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_.75fr]" aria-labelledby="quick-actions"><div className="rounded-lg border border-border bg-neutral-2 p-6 animate-rise" style={{ animationDelay: "260ms" }}><h2 id="quick-actions" className="text-title-20 font-medium">常用管理工作</h2><p className="mt-2 text-copy-14 leading-6 text-neutral-7">教学任务保存后，由服务端事务自动建立对应科目通道。</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/admin/assignments" className="group inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-copy-14 font-medium text-on-accent transition-[transform,background-color] duration-200 hover:-translate-y-px hover:bg-accent/90"><ClipboardText className="h-4 w-4" />分配教学任务<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" /></Link><Link href="/admin/announcements" className="group inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-copy-14 font-medium text-neutral-8 transition-colors duration-200 hover:bg-neutral-1"><Megaphone className="h-4 w-4" />发布校园公告<ArrowRight className="h-4 w-4 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" /></Link></div></div><div className="rounded-lg border border-border bg-neutral-1 p-6 animate-rise" style={{ animationDelay: "330ms" }}><p className="text-label-12 font-medium uppercase tracking-[1.5px] text-neutral-6">数据边界</p><h2 className="mt-4 text-title-20 font-medium text-neutral-10">服务端是唯一事实来源</h2><p className="mt-3 text-copy-14 leading-7 text-neutral-7">资源变更后自动刷新查询；实时事件只负责提醒同步，消息持久化结果以 Go API 返回为准。</p></div></section>
  </>;
}