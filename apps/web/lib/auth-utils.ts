import type { Role } from "@/lib/types";

export const ROLE_DESTINATIONS: Record<Role, string> = {
  admin: "/admin",
  teacher: "/teacher",
  classroom: "/classroom",
};

export function destinationForRole(role: Role): string {
  return ROLE_DESTINATIONS[role];
}

export function canAccessRole(current: Role | undefined, required: Role): boolean {
  return current === required;
}

export function isTwoMinuteRecallWindow(createdAt: string, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const elapsed = now - created;
  return elapsed >= 0 && elapsed <= 120_000;
}
