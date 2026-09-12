"use server";

import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

function csvEscape(value: string | null | undefined): string {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function toCSV(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  return "\uFEFF" + lines.join("\n");
}

export async function exportUsersCSV(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") return null;

  const rows = await db
    .select({
      username: schema.users.username,
      name: schema.users.name,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt));

  const roleLabels: Record<string, string> = {
    parent: "家长",
    teacher: "教师",
    classroom: "大屏",
    admin: "管理员",
  };

  return toCSV(
    ["登录ID", "姓名", "角色", "创建时间"],
    rows.map((r) => [
      r.username,
      r.name,
      roleLabels[r.role] ?? r.role,
      r.createdAt.toISOString(),
    ]),
  );
}

export async function exportBindingsCSV(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") return null;

  const teacherBindings = await db
    .select({
      teacherName: schema.users.name,
      teacherUsername: schema.users.username,
      className: schema.classes.name,
    })
    .from(schema.teacherClasses)
    .innerJoin(schema.users, eq(schema.teacherClasses.teacherId, schema.users.id))
    .innerJoin(schema.classes, eq(schema.teacherClasses.classId, schema.classes.id));

  const parentBindings = await db
    .select({
      parentName: schema.users.name,
      parentUsername: schema.users.username,
      className: schema.classes.name,
      studentName: schema.parentStudents.studentName,
    })
    .from(schema.parentStudents)
    .innerJoin(schema.users, eq(schema.parentStudents.parentId, schema.users.id))
    .innerJoin(schema.classes, eq(schema.parentStudents.classId, schema.classes.id));

  const teacherRows = teacherBindings.map((r) => [
    "教师",
    r.teacherUsername,
    r.teacherName,
    r.className,
    "",
  ]);
  const parentRows = parentBindings.map((r) => [
    "家长",
    r.parentUsername,
    r.parentName,
    r.className,
    r.studentName,
  ]);

  return toCSV(
    ["角色", "登录ID", "姓名", "班级", "学生姓名"],
    [...teacherRows, ...parentRows],
  );
}

export async function exportMessagesCSV(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") return null;

  const rows = await db
    .select({
      senderName: schema.users.name,
      senderRole: schema.users.role,
      conversationId: schema.messages.conversationId,
      type: schema.messages.type,
      content: schema.messages.content,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
    .orderBy(desc(schema.messages.createdAt))
    .limit(1000);

  const typeLabels: Record<string, string> = {
    text: "文本",
    image: "图片",
    urgent: "紧急",
    file: "文件",
    audio: "语音",
  };

  return toCSV(
    ["发送者", "角色", "会话ID", "类型", "内容", "时间"],
    rows.map((r) => [
      r.senderName,
      r.senderRole,
      r.conversationId,
      typeLabels[r.type] ?? r.type,
      r.type === "text" || r.type === "urgent" ? r.content : `[${typeLabels[r.type] ?? r.type}]`,
      r.createdAt.toISOString(),
    ]),
  );
}
