"use client";

import { useQueries } from "@tanstack/react-query";
import { fetchAllAdminPages } from "@/lib/admin-api";
import type { AdminChannel, AdminClass, Subject, TeacherAccount } from "@/lib/admin";

export const LOOKUP_PAGE_SIZES = {
  classes: 20,
  teachers: 50,
  subjects: 50,
  channels: 50,
} as const;

export function useAdminLookups(enabled = true) {
  const results = useQueries({
    queries: (Object.keys(LOOKUP_PAGE_SIZES) as Array<keyof typeof LOOKUP_PAGE_SIZES>).map((resource) => ({
      queryKey: ["admin", resource, "lookup"],
      enabled,
      queryFn: async () => fetchAllAdminPages<AdminClass | TeacherAccount | Subject | AdminChannel>(`/api/v1/admin/${resource}`, LOOKUP_PAGE_SIZES[resource]),
    })),
  });
  return {
    classes: (results[0].data ?? []) as AdminClass[],
    teachers: (results[1].data ?? []) as TeacherAccount[],
    subjects: (results[2].data ?? []) as Subject[],
    channels: (results[3].data ?? []) as AdminChannel[],
    isPending: enabled && results.some((result) => result.isPending),
    error: enabled ? results.find((result) => result.error)?.error : undefined,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}
