"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FloppyDisk } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { readableKey } from "@/lib/format";
import type { SettingsValues } from "@/lib/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, InlineError } from "@/components/ui/async-state";

export function SettingsForm() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "settings"], queryFn: () => apiFetch<SettingsValues>("/api/v1/admin/settings") });
  const [values, setValues] = useState<SettingsValues>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (query.data) setValues(query.data); }, [query.data]);
  const mutation = useMutation({
    mutationFn: (body: SettingsValues) => apiFetch<SettingsValues>("/api/v1/admin/settings", { method: "PATCH", body }),
    onSuccess: (data) => { if (data) setValues(data); setSaved(true); void queryClient.invalidateQueries({ queryKey: ["admin", "settings"] }); },
  });
  const entries = Object.entries(values);
  function submit(event: FormEvent) { event.preventDefault(); setSaved(false); mutation.mutate(values); }
  return <><PageHeader eyebrow="运行配置" title="系统设置" description="编辑服务端暴露的校园运行参数。字段类型与当前值均来自真实配置接口。" /><section className="max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-panel sm:p-7">{query.isPending ? <ListSkeleton rows={4} /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : entries.length === 0 ? <EmptyState title="没有可编辑的设置" description="服务端当前未返回任何系统设置字段。" /> : <form onSubmit={submit} className="space-y-6">{entries.map(([key, value]) => <div key={key}>{typeof value === "boolean" ? <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-200 px-4"><span className="text-sm font-medium text-zinc-700">{readableKey(key)}</span><input type="checkbox" className="h-5 w-5 accent-indigo-500" checked={value} onChange={(event) => { setSaved(false); setValues((current) => ({ ...current, [key]: event.target.checked })); }} /></label> : <div className="space-y-2"><Label htmlFor={`setting-${key}`}>{readableKey(key)}</Label><Input id={`setting-${key}`} type={typeof value === "number" ? "number" : "text"} value={String(value)} onChange={(event) => { setSaved(false); setValues((current) => ({ ...current, [key]: typeof value === "number" ? event.target.valueAsNumber : event.target.value })); }} required={typeof value === "number"} /><p className="text-xs text-zinc-400">配置键：{key}</p></div>}</div>)}{mutation.isError && <InlineError error={mutation.error} />}{saved && mutation.isSuccess && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">系统设置已保存到服务端。</p>}<div className="flex justify-end border-t border-zinc-100 pt-5"><Button type="submit" isLoading={mutation.isPending}><FloppyDisk className="h-4 w-4" />保存设置</Button></div></form>}</section></>;
}
