"use client";

import { useEffect, useState } from "react";
import { Megaphone, SignOut } from "@phosphor-icons/react";
import type { Channel } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useSessionStore } from "@/stores/session";
import { useRealtimeStore } from "@/stores/realtime";
import { cn } from "@/lib/utils";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ChannelList, useChannels } from "@/components/teacher/channel-list";
import { ChatWindow } from "@/components/teacher/chat-window";
import { BatchNoticeDialog } from "@/components/teacher/batch-notice-dialog";

function TeacherWorkspace() {
  const { logout } = useAuth();
  const user = useSessionStore((state) => state.user);
  const requestedChannelId = useRealtimeStore((state) => state.requestedChannelId);
  const requestChannel = useRealtimeStore((state) => state.requestChannel);
  const setActiveChannel = useRealtimeStore((state) => state.setActiveChannel);
  const channelsQuery = useChannels();
  const [selected, setSelected] = useState<Channel>();
  const [mobileChat, setMobileChat] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const activeChannel = selected ? channelsQuery.data?.find((channel) => channel.id === selected.id) ?? selected : undefined;

  useEffect(() => {
    setActiveChannel(activeChannel?.id);
    return () => setActiveChannel(undefined);
  }, [activeChannel?.id, setActiveChannel]);
  useEffect(() => {
    if (!requestedChannelId) return;
    const channel = channelsQuery.data?.find((item) => item.id === requestedChannelId);
    if (channel) {
      setSelected(channel);
      setMobileChat(true);
    }
    requestChannel(undefined);
  }, [requestedChannelId, channelsQuery.data, requestChannel]);

  function selectChannel(channel: Channel) { setSelected(channel); setMobileChat(true); }

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-paper">
      <header className="flex min-h-16 items-center gap-4 border-b border-border bg-paper/85 px-4 backdrop-blur-sm sm:px-6">
        <Brand />
        <div className="hidden h-6 w-px bg-neutral-3 sm:block" />
        <div className="hidden min-w-0 sm:block"><p className="truncate text-copy-14 font-medium text-neutral-9">教师工作区</p><p className="text-label-12 text-neutral-6">按教学任务组织沟通</p></div>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:block"><ConnectionIndicator /></div>
          <Button variant="secondary" onClick={() => setBatchOpen(true)} disabled={!channelsQuery.data?.length}><Megaphone className="h-4 w-4" /><span className="hidden sm:inline">批量通知</span></Button>
          <div className="hidden text-right lg:block"><p className="text-copy-14 font-medium text-neutral-9">{user?.display_name}</p><p className="y-meta text-label-12 text-neutral-6">教师</p></div>
          <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="退出登录"><SignOut className="h-5 w-5" /></Button>
        </div>
      </header>
      <main id="main-content" className="grid min-h-0 flex-1 md:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className={cn("min-h-0 border-r border-border bg-neutral-1", mobileChat ? "hidden md:block" : "block animate-drawerIn md:animate-none")} aria-label="会话导航"><ChannelList selectedId={selected?.id} onSelect={selectChannel} /></aside>
        <div className={cn("min-h-0", mobileChat ? "block animate-chatIn md:animate-none" : "hidden md:block")}><ChatWindow channel={activeChannel} onBack={() => setMobileChat(false)} /></div>
      </main>
      <BatchNoticeDialog open={batchOpen} channels={channelsQuery.data ?? []} onClose={() => setBatchOpen(false)} />
    </div>
  );
}

export function TeacherClient() { return <AuthGuard role="teacher"><TeacherWorkspace /></AuthGuard>; }
