"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { ScheduleEntry } from "./queries";

async function requireAdmin() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") {
    throw new Error("仅管理员可操作");
  }
  return session.user;
}

const scheduleEntrySchema = z.object({
  dayOfWeek: z.number().int().min(1).max(7),
  period: z.number().int().min(1).max(12),
  subjectId: z.string().uuid(),
  teacherId: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const saveSchema = z.object({
  classId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  entries: z.array(scheduleEntrySchema).max(12),
});

export type SaveResult = { ok: true } | { ok: false; error: string };

/** 保存某班某天课表（先删该天再插） */
export async function saveSchedule(
  input: z.infer<typeof saveSchema>,
): Promise<SaveResult> {
  try {
    await requireAdmin();
    const parsed = saveSchema.parse(input);

    await db.delete(schema.schedule)
      .where(and(eq(schema.schedule.classId, parsed.classId), eq(schema.schedule.dayOfWeek, parsed.dayOfWeek)));

    if (parsed.entries.length > 0) {
      await db.insert(schema.schedule).values(
        parsed.entries.map((e) => ({
          classId: parsed.classId,
          dayOfWeek: parsed.dayOfWeek,
          period: e.period,
          subjectId: e.subjectId,
          teacherId: e.teacherId,
          startTime: e.startTime,
          endTime: e.endTime,
        })),
      );
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "保存失败" };
  }
}

/** 查某班完整课表（所有天，按 dayOfWeek, period 升序） */
export async function getFullSchedule(
  classId: string,
): Promise<ScheduleEntry[]> {
  try {
    await requireAdmin();
    const rows = await db
      .select({
        id: schema.schedule.id,
        dayOfWeek: schema.schedule.dayOfWeek,
        period: schema.schedule.period,
        subjectId: schema.subjects.id,
        subjectName: schema.subjects.name,
        subjectSlug: schema.subjects.slug,
        teacherId: schema.users.id,
        teacherName: schema.users.name,
        startTime: schema.schedule.startTime,
        endTime: schema.schedule.endTime,
      })
      .from(schema.schedule)
      .innerJoin(schema.subjects, eq(schema.schedule.subjectId, schema.subjects.id))
      .innerJoin(schema.users, eq(schema.schedule.teacherId, schema.users.id))
      .where(eq(schema.schedule.classId, classId))
      .orderBy(asc(schema.schedule.dayOfWeek), asc(schema.schedule.period));
    return rows;
  } catch {
    return [];
  }
}
