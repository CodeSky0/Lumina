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

export type LookupResource = keyof typeof LOOKUP_PAGE_SIZES;

export const ALL_LOOKUPS: readonly LookupResource[] = ["classes", "teachers", "subjects", "channels"];

export function useAdminLookups(enabled = true, resources: readonly LookupResource[] = ALL_LOOKUPS) {
  const selected = ALL_LOOKUPS.filter((resource) => resources.includes(resource));
  const results = useQueries({
    queries: selected.map((resource) => ({
      queryKey: ["admin", resource, "lookup"],
      enabled,
      queryFn: async () => fetchAllAdminPages<AdminClass | TeacherAccount | Subject | AdminChannel>(`/api/v1/admin/${resource}`, LOOKUP_PAGE_SIZES[resource]),
    })),
  });
  const dataFor = (resource: LookupResource) => results[selected.indexOf(resource)]?.data ?? [];
  return {
    classes: dataFor("classes") as AdminClass[],
    teachers: dataFor("teachers") as TeacherAccount[],
    subjects: dataFor("subjects") as Subject[],
    channels: dataFor("channels") as AdminChannel[],
    isPending: enabled && results.some((result) => result.isPending),
    error: enabled ? results.find((result) => result.error)?.error : undefined,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}