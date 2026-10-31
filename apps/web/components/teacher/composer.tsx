"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, File as FileIcon, Image as ImageIcon, PaperPlaneRight, Siren, X } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { MAX_TEXT_LENGTH, validateMessage, validateUpload } from "@/lib/messages";
import type { Channel, Message, MessageType, Upload } from "@/lib/types";
import { cn } from "@/lib/utils";
import { uploadMessageFields } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/ui/async-state";

const messageTypes: Array<{ value: MessageType; label: string; icon: typeof Bell }> = [
  { value: "text", label: "文本", icon: PaperPlaneRight },
  { value: "notice", label: "通知", icon: Bell },
  { value: "urgent", label: "紧急", icon: Siren },
];

export function Composer({ channel, replyTo, onCancelReply, allowedTypes = ["text", "notice", "urgent"], large = false }: {
  channel: Channel;
  replyTo?: Message;
  onCancelReply: () => void;
  allowedTypes?: MessageType[];
  large?: boolean;
}) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<MessageType>("text");
  const [content, setContent] = useState("");
  const [error, setError] = useState<unknown>(null);

  const sent = () => {
    setContent("");
    setError(null);
    onCancelReply();
    void queryClient.invalidateQueries({ queryKey: ["messages", channel.id] });
    void queryClient.invalidateQueries({ queryKey: ["channels"] });
  };
  const sendMutation = useMutation({
    mutationFn: (payload: { type: MessageType; content: string; reply_to_id?: string; metadata?: Message["metadata"] }) => apiFetch<Message>(`/api/v1/channels/${encodeURIComponent(channel.id)}/messages`, { method: "POST", body: payload }),
    onSuccess: sent,
    onError: setError,
  });
  const uploadMutation = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "image" | "file" }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("channel_id", channel.id);
      const upload = await apiFetch<Upload>("/api/v1/uploads", { method: "POST", body: form });
      const { fileName, metadata } = uploadMessageFields(upload, file);
      return sendMutation.mutateAsync({
        type: kind,
        content: fileName,
        reply_to_id: replyTo?.id,
        metadata,
      });
    },
    onError: setError,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateMessage(type, content);
    if (validation) { setError(new Error(validation)); return; }
    sendMutation.mutate({ type, content: content.trim(), reply_to_id: replyTo?.id });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function selectFile(file: File | undefined, kind: "image" | "file") {
    if (!file) return;
    const validation = validateUpload(file, kind);
    if (validation) { setError(new Error(validation)); return; }
    setError(null);
    uploadMutation.mutate({ file, kind });
  }

  const isPending = sendMutation.isPending || uploadMutation.isPending;
  const length = Array.from(content).length;
  const visibleTypes = messageTypes.filter((item) => allowedTypes.includes(item.value));
  return (
    <div className={cn("border-t bg-white", large ? "p-5" : "p-3 sm:p-4", type === "urgent" ? "border-red-200" : "border-zinc-100")}>
      {replyTo && <div className={cn("mb-3 flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2 text-zinc-500", large ? "text-lg" : "text-xs")}><span className="min-w-0 flex-1 truncate">回复 {replyTo.sender_name}：{replyTo.content}</span><Button variant="ghost" size={large ? "touchIcon" : "icon"} className={large ? undefined : "h-8 min-h-8 w-8"} onClick={onCancelReply} aria-label="取消回复"><X className="h-4 w-4" /></Button></div>}
      <div className={cn("mb-3 flex flex-wrap items-center gap-2", visibleTypes.length > 1 ? "justify-between" : "justify-end")}>
        {visibleTypes.length > 1 && <div className="flex rounded-xl bg-zinc-100 p-1" role="group" aria-label="消息类型">
          {visibleTypes.map((item) => <button type="button" key={item.value} onClick={() => setType(item.value)} aria-pressed={type === item.value} className={cn("flex items-center gap-1.5 rounded-lg px-3 font-medium transition", large ? "min-h-12 text-lg" : "min-h-8 text-xs", type === item.value ? item.value === "urgent" ? "bg-red-600 text-white" : "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900")}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}
        </div>}
        <div className="flex gap-1">
          <input ref={imageInput} type="file" accept="image/*" className="sr-only" aria-label="选择图片" onChange={(event) => { selectFile(event.target.files?.[0], "image"); event.target.value = ""; }} />
          <input ref={fileInput} type="file" className="sr-only" aria-label="选择文件" onChange={(event) => { selectFile(event.target.files?.[0], "file"); event.target.value = ""; }} />
          <Button type="button" variant="ghost" size={large ? "touch" : "sm"} onClick={() => imageInput.current?.click()} disabled={isPending}><ImageIcon className="h-4 w-4" />图片</Button>
          <Button type="button" variant="ghost" size={large ? "touch" : "sm"} onClick={() => fileInput.current?.click()} disabled={isPending}><FileIcon className="h-4 w-4" />文件</Button>
        </div>
      </div>
      <form ref={formRef} onSubmit={submit} className="space-y-3">
        <Textarea value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={handleKeyDown} className={cn("resize-none border-0 bg-zinc-50 focus:ring-1", large ? "min-h-24 text-lg leading-8" : "min-h-20")} maxLength={MAX_TEXT_LENGTH} placeholder={type === "urgent" ? "说明紧急情况，教室必须确认后才能关闭提醒" : type === "notice" ? "输入需要重点关注的通知" : "输入消息，Enter 发送，Shift + Enter 换行"} aria-label="消息内容" disabled={isPending} />
        <InlineError error={error} />
        <div className="flex items-center justify-between gap-3"><span className={cn(large ? "text-base" : "text-xs", length > MAX_TEXT_LENGTH ? "text-red-600" : "text-zinc-400")}>{uploadMutation.isPending ? "正在安全上传附件" : `${length} / ${MAX_TEXT_LENGTH}`}</span><Button type="submit" size={large ? "touch" : "default"} variant={type === "urgent" ? "danger" : "primary"} isLoading={isPending} disabled={!content.trim()}><PaperPlaneRight className="h-4 w-4" />{type === "urgent" ? "发送紧急通知" : "发送"}</Button></div>
      </form>
    </div>
  );
}
