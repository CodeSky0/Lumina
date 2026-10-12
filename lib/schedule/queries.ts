/**
 * 课表查询 — 供大屏端 Server Component 直接调用。
 */
import { db, schema } from "@/lib/db";
import { and, asc, eq } from "drizzle-orm";

export type ScheduleEntry = {
  id: string;
  dayOfWeek: number;
  period: number;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  teacherId: string;
  teacherName: string;
  startTime: string;
  endTime: string;
};

/** 查某班某天的课表（按 period 升序） */
export async function getScheduleByDay(
  classId: string,
  dayOfWeek: number,
): Promise<ScheduleEntry[]> {
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
    .where(
      and(
        eq(schema.schedule.classId, classId),
        eq(schema.schedule.dayOfWeek, dayOfWeek),
      ),
    )
    .orderBy(asc(schema.schedule.period));
  return rows;
}

/** 查当前课和下节课信息（大屏端用） */
export async function getCurrentAndNextClass(
  classId: string,
): Promise<{
  current: ScheduleEntry | null;
  next: ScheduleEntry | null;
  todaySchedule: ScheduleEntry[];
}> {
  const now = new Date();
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const todaySchedule = await getScheduleByDay(classId, dayOfWeek);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let current: ScheduleEntry | null = null;
  let next: ScheduleEntry | null = null;

  for (const entry of todaySchedule) {
    const [eh, em] = entry.startTime.split(":").map(Number);
    const [exh, exm] = entry.endTime.split(":").map(Number);
    const startMin = (eh ?? 0) * 60 + (em ?? 0);
    const endMin = (exh ?? 0) * 60 + (exm ?? 0);
    if (nowMinutes >= startMin && nowMinutes < endMin) {
      current = entry;
    } else if (nowMinutes < startMin && !next) {
      next = entry;
    }
  }

  return { current, next, todaySchedule };
}
