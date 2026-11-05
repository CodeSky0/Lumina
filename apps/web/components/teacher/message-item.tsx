"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowBendUpLeft, ArrowClockwise, Check, Checks, PencilSimple, Trash, WarningCircle } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { canRecall, validateMessage } from "@/lib/messages";
import { formatDateTime } from "@/lib/format";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineError } from "@/components/ui/async-state";
import { FileAttachment } from "@/components/teacher/file-attachment";
import { ConfirmationDetails } from "@/components/urgent/confirmation-status";

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  replyTarget?: Message;
  large?: boolean;
  onReply?: (message: Message) => void;
  onRead: (message: Message) => Promise<void>;
  onRetry?: (clientMsgId: string) => void;
}

export function MessageItem({ message, currentUserId, replyTarget, large = false, onReply, onRead, onRetry }: MessageItemProps) {
  const queryClient = useQueryClient();
  const articleRef = useRef<HTMLElement>(null);
  const readSent = useRef(false);
  const readPending = useRef(false);
  const own = message.sender_id === currentUserId;
  const failed = message.delivery_state === "failed";
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [editError, setEditError] = useState<unknown>(null);
  const [confirmRecall, setConfirmRecall] = useState(false);
  const [recallable, setRecallable] = useState(() => canRecall(message, currentUserId));

  useEffect(() => {
    if (own || message.type === "system" || message.deleted_at || readSent.current) return;
    const element = articleRef.current;
    if (!element) return;
    const send = async (observer?: IntersectionObserver) => {
      if (readSent.current || readPending.current) return;
      readPending.current = true;
      try {
        await onRead(message);
        readSent.current = true;
        observer?.disconnect();
      } catch {
        // 保留观察器，下一次进入视口时可重新提交已读请求。
      } finally {
        readPending.current = false;
      }
    };
    if (typeof IntersectionObserver === "undefined") { void send(); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void send(observer);
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [message, onRead, own]);

  useEffect(() => {
    if (!recallable) return;
    const remaining = 120_000 - (Date.now() - new Date(message.created_at).getTime());
    const timer = setTimeout(() => setRecallable(false), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [message.created_at, recallable]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["messages", message.channel_id] });
  const editMutation = useMutation({
    mutationFn: (content: string) => apiFetch<Message>(`/api/v1/messages/${encodeURIComponent(message.id)}`, { method: "PATCH", body: { content } }),
    onSuccess: () => { setIsEditing(false); setEditError(null); void invalidate(); },
    onError: setEditError,
  });
  const recallMutation = useMutation({
    mutationFn: () => apiFetch<void>(`/api/v1/messages/${encodeURIComponent(message.id)}`, { method: "DELETE" }),
    onSuccess: () => { setConfirmRecall(false); void invalidate(); },
  });

  function saveEdit() {
    const error = validateMessage(message.type, editContent);
    if (error) { setEditError(new Error(error)); return; }
    editMutation.mutate(editContent.trim());
  }

  if (message.type === "system") {
    return <article ref={articleRef} className="flex justify-center py-2"><p className={cn("rounded-full bg-zinc-100 px-4 py-2 text-center text-zinc-500", large ? "text-lg" : "text-xs")}>{message.content}</p></article>;
  }

  const urgent = message.type === "urgent";
  const notice = message.type === "notice";
  return (
    <article ref={articleRef} className={cn("group flex gap-3 px-1 py-3", own && "flex-row-reverse")} aria-label={`${message.sender_name}发送的消息`}>
      <div className={cn("flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl text-xs font-semibold", own ? "bg-indigo-100 text-indigo-700" : "bg-zinc-200 text-zinc-600", large && "h-12 w-12 text-base")} aria-hidden="true">{message.sender_name.slice(0, 1)}</div>
      <div className={cn("min-w-0 max-w-[82%] sm:max-w-[72%]", own && "flex flex-col items-end")}>
        <div className={cn("mb-1.5 flex items-center gap-2 text-xs text-zinc-400", own && "flex-row-reverse", large && "text-base")}><span className="font-medium text-zinc-600">{message.sender_name}</span><time dateTime={message.created_at}>{formatDateTime(message.created_at)}</time></div>
        <div className={cn(
          "rounded-2xl border px-4 py-3",
          own ? "rounded-tr-md border-indigo-500 bg-indigo-500 text-white" : "rounded-tl-md border-zinc-200 bg-white text-zinc-800",
          notice && "border-amber-300 bg-amber-50 text-amber-950",
          urgent && "border-red-300 bg-red-50 text-red-950",
          failed && "border-red-300 bg-zinc-100 text-zinc-500",
          large && "px-5 py-4 text-lg leading-8",
        )}>
          {(notice || urgent) && <Badge tone={urgent ? "red" : "yellow"} className="mb-2">{urgent ? "紧急通知" : "普通通知"}</Badge>}
          {message.reply_to_id && <div className={cn("mb-2 border-l-2 pl-2 text-xs opacity-75", own ? "border-white/60" : "border-zinc-300", large && "text-base")}>{replyTarget ? `回复 ${replyTarget.sender_name}：${replyTarget.content}` : "回复一条历史消息"}</div>}
          {message.deleted_at ? <p className={cn("italic opacity-65", large ? "text-lg" : "text-sm")}>消息已撤回</p> : isEditing ? (
            <div className="w-72 max-w-full space-y-3 text-zinc-900"><Textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={2000} aria-label="编辑消息内容" /><InlineError error={editError} /><div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>取消</Button><Button size="sm" onClick={saveEdit} isLoading={editMutation.isPending}>保存</Button></div></div>
          ) : (
            <><p className={cn("whitespace-pre-wrap break-words leading-6", large && "text-lg leading-8")}>{message.content}</p>{(message.type === "image" || message.type === "file") && <FileAttachment message={message} large={large} />}</>
          )}
        </div>
        {own && urgent && !message.delivery_state && !message.deleted_at && <ConfirmationDetails kind="message" id={message.id} summary="查看班级确认状态" className="mt-2 w-full" summaryClassName="cursor-pointer text-xs font-medium text-indigo-600" />}
        <div className={cn("mt-1.5 flex min-h-7 items-center gap-1 text-zinc-400", own && "flex-row-reverse")}>
          {own && !message.deleted_at && (message.delivery_state === "sending" ? (
            <span className={cn("mr-1 flex items-center gap-1 text-xs", large && "text-base")}><Checks className="h-3.5 w-3.5" />发送中</span>
          ) : failed ? (
            <button type="button" className={cn("mr-1 flex min-h-7 items-center gap-1 text-xs font-medium text-red-600", large && "min-h-12 text-base")} onClick={() => message.client_msg_id && onRetry?.(message.client_msg_id)} aria-label={`发送失败，重试：${message.error ?? "网络错误"}`}><WarningCircle className="h-4 w-4" />发送失败<ArrowClockwise className="h-3.5 w-3.5" />重试</button>
          ) : (
            <span className={cn("mr-1 flex items-center gap-1 text-xs", large && "text-base")}>{message.read_count > 0 ? <Checks className="h-3.5 w-3.5 text-sky-500" /> : (message.delivery_count ?? 0) > 0 ? <Checks className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{message.read_count > 0 ? `${message.read_count} 人已读` : (message.delivery_count ?? 0) > 0 ? "已送达" : "已发送"}</span>
          ))}
          {!message.deleted_at && !isEditing && !message.delivery_state && (
            <div className="flex opacity-100 transition focus-within:opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              {onReply && <Button variant="ghost" size="sm" className={cn(large && "min-h-12 text-base")} onClick={() => onReply(message)}><ArrowBendUpLeft className="h-3.5 w-3.5" />回复</Button>}
              {own && message.type === "text" && <Button variant="ghost" size="sm" className={cn(large && "min-h-12 text-base")} onClick={() => { setEditContent(message.content); setIsEditing(true); }}><PencilSimple className="h-3.5 w-3.5" />编辑</Button>}
              {own && recallable && <Button variant="ghost" size="sm" className={cn("text-red-600", large && "min-h-12 text-base")} onClick={() => setConfirmRecall(true)}><Trash className="h-3.5 w-3.5" />撤回</Button>}
            </div>
          )}
          {message.confirmed_at && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" />已确认</span>}
        </div>
      </div>
      <ConfirmDialog open={confirmRecall} title="撤回这条消息？" description="撤回后，会话成员将只能看到撤回状态。此操作无法撤销。" confirmLabel="撤回消息" isLoading={recallMutation.isPending} error={recallMutation.error} onClose={() => setConfirmRecall(false)} onConfirm={() => recallMutation.mutate()} />
    </article>
  );
}
