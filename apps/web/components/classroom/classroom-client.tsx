"use client";

import { useState } from "react";
import { ArrowRight, ChatsCircle, SignOut } from "@phosphor-icons/react";
import type { Channel } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useChannels } from "@/components/teacher/channel-list";
import { useSessionStore } from "@/stores/session";
import { formatFullDate } from "@/lib/format";
import { isSafeHexColor } from "@/lib/utils";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { EmptyState, ErrorState } from "@/components/ui/async-state";
import { ListSkeleton } from "@/components/ui/skeleton";
import { SubjectIcon } from "@/components/classroom/subject-icon";
import { AnnouncementBar } from "@/components/classroom/announcement-bar";
import { ClassroomChat } from "@/components/classroom/classroom-chat";

function ClassroomWorkspace() {
  const { logout } = useAuth();
  const user = useSessionStore((state) => state.user);
  const channelsQuery = useChannels();
  const [selected, setSelected] = useState<Channel>();

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="sticky top-0 z-20 border-b border-border bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex min-h-20 max-w-[1800px] items-center gap-5 px-5 py-4 sm:px-8">
          <Brand />
          <div className="hidden h-8 w-px bg-neutral-3 sm:block" />
          <div className="hidden sm:block"><p className="text-copy-14 font-medium text-neutral-9">{user?.display_name}</p><p className="y-meta text-label-12 text-neutral-6">教室消息中心</p></div>
          <div className="ml-auto flex items-center gap-4"><div className="hidden md:block"><ConnectionIndicator /></div><Button variant="ghost" size="touch" onClick={() => void logout()} aria-label="退出教室设备登录"><SignOut className="h-6 w-6" /><span className="hidden sm:inline">退出</span></Button></div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-[1800px] space-y-8 px-5 py-7 sm:px-8 sm:py-9">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="y-meta text-copy-13 text-accent">{formatFullDate()}</p><h1 className="mt-2 text-title-28 font-medium tracking-tight text-neutral-10 sm:text-display-36">今天的课堂提醒</h1><p className="mt-3 max-w-xl text-copy-16 leading-7 text-neutral-7">选择科目卡片查看教师消息；紧急通知需要本班确认后才能关闭。</p></div><p className="y-meta text-label-12 text-neutral-6">{channelsQuery.data?.length ?? 0} 个可用通道</p></section>
        <AnnouncementBar />
        <section aria-labelledby="channels-title"><h2 id="channels-title" className="sr-only">科目消息通道</h2>
          {channelsQuery.isPending ? <ListSkeleton rows={4} /> : channelsQuery.isError ? <ErrorState error={channelsQuery.error} onRetry={() => void channelsQuery.refetch()} /> : channelsQuery.data.length === 0 ? <EmptyState icon={<ChatsCircle className="h-7 w-7" />} title="暂无科目通道" description="管理员分配教学任务后，本科的科目卡片会显示在这里。" /> : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
              {channelsQuery.data.map((channel, index) => {
                const color = isSafeHexColor(channel.subject_color) ? channel.subject_color : "#c56473";
                return <button key={channel.id} onClick={() => setSelected(channel)} className="group/card lift sheen relative min-h-48 overflow-hidden rounded-xl border border-border bg-neutral-2 p-6 text-left outline-hidden animate-rise focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[0.99]" style={{ borderTopColor: color, borderTopWidth: 3, animationDelay: `${index * 60}ms` }} aria-label={`打开${channel.name}消息，${channel.unread_count}条未读`}>
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-10 h-36 w-36 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover/card:opacity-80" style={{ background: `radial-gradient(circle, ${color}2e, transparent 68%)` }} />
                  <div className="relative flex items-start justify-between gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-lg transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:-translate-y-0.5 group-hover/card:rotate-[-4deg]" style={{ color, backgroundColor: `${color}12` }}><SubjectIcon name={channel.subject_icon} className="h-8 w-8" /></span>{channel.unread_count > 0 && <span className="flex min-h-8 min-w-8 items-center justify-center rounded-full bg-accent px-2 text-copy-13 font-medium text-on-accent animate-pop">{channel.unread_count > 99 ? "99+" : channel.unread_count}</span>}</div>
                  <h3 className="mt-6 text-title-24 font-medium tracking-tight text-neutral-10">{channel.subject_name ?? channel.name}</h3><p className="mt-2 truncate text-copy-15 text-neutral-7">{channel.teacher_name ?? channel.name}</p>
                  <div className="relative mt-5 flex min-h-12 items-center justify-between gap-3 border-t border-border pt-4"><span className="truncate text-copy-13 text-neutral-7">{channel.last_message?.content ?? "暂无新消息"}</span><ArrowRight className="h-5 w-5 shrink-0 text-neutral-6 transition-[transform,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:translate-x-1 group-hover/card:text-accent" aria-hidden="true" /></div>
                </button>;
              })}
            </div>
          )}
        </section>
      </main>
      <ClassroomChat channel={selected} onClose={() => setSelected(undefined)} />
    </div>
  );
}

export function ClassroomClient() { return <AuthGuard role="classroom"><ClassroomWorkspace /></AuthGuard>; }