"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/realtime";
import { MessageSendProvider } from "@/lib/message-sender";
import { useSessionStore } from "@/stores/session";
import { ConnectionBanner } from "@/components/ui/connection-banner";
import { RealtimeNotification } from "@/components/ui/realtime-notification";
import { TeacherUrgentDialog } from "@/components/urgent/teacher-urgent-dialog";

export function Providers({ children }: { children: ReactNode }) {
  const userId = useSessionStore((state) => state.user?.id);
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && [401, 403, 404, 422, 429].includes(error.status)) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          <MessageSendProvider key={userId ?? "anonymous"}>
            <ConnectionBanner />
            <RealtimeNotification />
            <TeacherUrgentDialog />
            {children}
          </MessageSendProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
