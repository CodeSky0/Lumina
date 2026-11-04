import { apiFetch } from "@/lib/api";
import type { ListResult } from "@/lib/types";
import { extractItems } from "@/lib/utils";

export interface AdminPage<T> {
  items: T[];
  total?: number;
  totalPages: number;
}

export function normalizeAdminPage<T>(result: ListResult<T>): AdminPage<T> {
  return {
    items: extractItems(result),
    total: Array.isArray(result) ? result.length : result.total,
    totalPages: Array.isArray(result) ? 1 : Math.max(1, result.total_pages ?? 1),
  };
}

function pagedUrl(endpoint: string, page: number, size: number): string {
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page}&size=${size}`;
}

export async function fetchAdminPage<T>(endpoint: string, page: number, size: number): Promise<AdminPage<T>> {
  return normalizeAdminPage(await apiFetch<ListResult<T>>(pagedUrl(endpoint, page, size)));
}

export async function fetchAllAdminPages<T>(endpoint: string, size: number): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await fetchAdminPage<T>(endpoint, page, size);
    items.push(...result.items);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return items;
}
