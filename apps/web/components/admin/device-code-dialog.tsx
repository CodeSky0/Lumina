"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Key } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import type { ResourceRow } from "@/components/admin/resource-form";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/async-state";

interface DeviceCodeResult {
  code: string;
  notice: string;
}

export function DeviceCodeDialog({ open, record, onClose }: { open: boolean; record?: ResourceRow; onClose: () => void }) {
  const [result, setResult] = useState<DeviceCodeResult>();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  useEffect(() => {
    setResult(undefined);
    setCopied(false);
    setCopyError("");
  }, [open, record?.id]);

  const mutation = useMutation({
    mutationFn: () => apiFetch<DeviceCodeResult>(`/api/v1/admin/classes/${encodeURIComponent(record?.id ?? "")}/device-code`, { method: "POST" }),
    onSuccess: (data) => setResult(data),
  });

  function close() {
    setResult(undefined);
    setCopied(false);
    setCopyError("");
    mutation.reset();
    onClose();
  }

  async function copyCode() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("复制失败，请手动选择并复制设备码");
    }
  }

  return <Dialog open={open} title={`轮换${String(record?.name ?? "班级")}设备码`} description={result?.notice ?? "轮换后旧设备码立即失效。新设备码仅在本次对话框中显示，不会写入浏览器持久化存储。"} onClose={mutation.isPending ? undefined : close}>
    {result ? <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-medium text-emerald-800">请立即复制并安全保存</p>
        <code className="mt-3 block select-all break-all rounded-xl bg-white px-4 py-3 text-center font-mono text-xl tracking-wider text-zinc-950">{result.code}</code>
      </div>
      {copyError && <InlineError error={copyError} />}
      <div className="flex justify-end gap-3"><Button variant="secondary" onClick={close}>关闭</Button><Button onClick={() => void copyCode()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "已复制" : "复制设备码"}</Button></div>
    </div> : <div className="space-y-5">
      {mutation.error && <InlineError error={mutation.error} />}
      <div className="flex justify-end gap-3"><Button variant="secondary" onClick={close} disabled={mutation.isPending}>取消</Button><Button variant="warning" onClick={() => mutation.mutate()} isLoading={mutation.isPending}><Key className="h-4 w-4" />确认轮换</Button></div>
    </div>}
  </Dialog>;
}
