"use client";

import { useEffect, useState } from "react";
import { DownloadSimple, File as FileIcon, WarningCircle } from "@phosphor-icons/react";
import { apiFetch, downloadFile } from "@/lib/api";
import { formatFileSize } from "@/lib/format";
import type { Message } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function AuthorizedImage({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setError(null);
    setUrl(undefined);
    void apiFetch<Blob>(`/api/v1/files/${encodeURIComponent(id)}`, { responseType: "blob" }).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(setError);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, attempt]);

  if (error) return <div className="flex min-h-28 items-center gap-2 rounded-md bg-error/8 p-4 text-copy-14 text-error"><WarningCircle className="h-5 w-5" />图片加载失败<Button variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>重试</Button></div>;
  if (!url) return <Skeleton className="h-52 w-full max-w-md" />;
  return <img src={url} alt={alt} className="max-h-96 w-auto max-w-full rounded-md border border-border object-contain" />;
}

export function FileAttachment({ message, large = false }: { message: Message; large?: boolean }) {
  const id = message.metadata.file_id;
  const name = message.metadata.file_name ?? message.content ?? "附件";
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  if (!id) return <p className="text-copy-14 text-error">附件信息不完整，请联系发送者</p>;

  async function download() {
    if (!id) return;
    setIsDownloading(true);
    setDownloadError(null);
    try { await downloadFile(id, name); } catch (error) { setDownloadError(error); } finally { setIsDownloading(false); }
  }

  return (
    <div className="mt-2 space-y-2">
      {message.type === "image" ? <AuthorizedImage id={id} alt={name} /> : (
        <div className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-paper/80 p-3">
          <FileIcon className="h-7 w-7 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="truncate text-copy-14 font-medium text-neutral-9">{name}</p><p className="text-label-12 text-neutral-7">{formatFileSize(message.metadata.size)}</p></div>
          <Button variant="ghost" size={large ? "touchIcon" : "icon"} onClick={download} isLoading={isDownloading} aria-label={`下载 ${name}`}><DownloadSimple className="h-5 w-5" /></Button>
        </div>
      )}
      {message.type === "image" && <Button variant={large ? "secondary" : "ghost"} size={large ? "touch" : "sm"} onClick={download} isLoading={isDownloading}><DownloadSimple className="h-4 w-4" />下载图片</Button>}
      {downloadError ? <p role="alert" className="text-label-12 text-error">{downloadError instanceof Error ? downloadError.message : "下载失败"}</p> : null}
    </div>
  );
}
