import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ListData, ListResult } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractItems<T>(result: ListResult<T>): T[] {
  if (Array.isArray(result)) return result;
  const data = result as ListData<T>;
  return data.items ?? data.data ?? data.results ?? [];
}

export function isSafeHexColor(value?: string): value is string {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
}

export function clampText(value: string, max = 2000): string {
  return Array.from(value).slice(0, max).join("");
}
