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
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="y-meta text-copy-13 text-accent">{formatFullDate()}</p><h1 className="mt-2 text-title-28 font-medium tracking-tight text-neutral-10 sm:text-display-36">今天的课堂消息</h1><p className="mt-3 max-w-xl text-copy-16 leading-7 text-neutral-7">选择科目卡片，查看教师发送的消息与资料。</p></div><p className="y-meta text-label-12 text-neutral-6">{channelsQuery.data?.length ?? 0} 个可用通道</p></section>
        <AnnouncementBar />
        <section aria-labelledby="channels-title"><h2 id="channels-title" className="sr-only">科目消息通道</h2>
          {channelsQuery.isPending ? <ListSkeleton rows={4} /> : channelsQuery.isError ? <ErrorState error={channelsQuery.error} onRetry={() => void channelsQuery.refetch()} /> : channelsQuery.data.length === 0 ? <EmptyState icon={<ChatsCircle className="h-7 w-7" />} title="暂无科目通道" description="管理员分配教学任务后，本科的科目卡片会显示在这里。" /> : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-4">
              {channelsQuery.data.map((channel) => {
                const color = isSafeHexColor(channel.subject_color) ? channel.subject_color : "#c56473";
                return <button key={channel.id} onClick={() => setSelected(channel)} className="group relative min-h-48 overflow-hidden rounded-xl border border-border bg-neutral-2 p-6 text-left outline-hidden transition duration-200 hover:bg-neutral-3/60 focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[0.99]" style={{ borderTopColor: color, borderTopWidth: 3 }} aria-label={`打开${channel.name}消息，${channel.unread_count}条未读`}>
                  <div className="flex items-start justify-between gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-lg" style={{ color, backgroundColor: `${color}12` }}><SubjectIcon name={channel.subject_icon} className="h-8 w-8" /></span>{channel.unread_count > 0 && <span className="flex min-h-8 min-w-8 items-center justify-center rounded-full bg-accent px-2 text-copy-13 font-medium text-on-accent">{channel.unread_count > 99 ? "99+" : channel.unread_count}</span>}</div>
                  <h3 className="mt-6 text-title-24 font-medium tracking-tight text-neutral-10">{channel.subject_name ?? channel.name}</h3><p className="mt-2 truncate text-copy-15 text-neutral-7">{channel.teacher_name ?? channel.name}</p>
                  <div className="mt-5 flex min-h-12 items-center justify-between gap-3 border-t border-border pt-4"><span className="truncate text-copy-13 text-neutral-7">{channel.last_message?.content ?? "暂无新消息"}</span><ArrowRight className="h-5 w-5 shrink-0 text-neutral-6 transition-colors group-hover:text-accent" aria-hidden="true" /></div>
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