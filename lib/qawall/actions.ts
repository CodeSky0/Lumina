"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

export type QuestionItem = {
  id: string;
  askerId: string;
  askerName: string;
  askerRole: string;
  title: string;
  content: string;
  className: string | null;
  resolvedAt: Date | null;
  answerCount: number;
  createdAt: Date;
};

export type AnswerItem = {
  id: string;
  answererId: string;
  answererName: string;
  answererRole: string;
  content: string;
  createdAt: Date;
};

export type QuestionDetail = QuestionItem & {
  answers: AnswerItem[];
};

/** 查答疑墙列表 */
export async function getQuestions(
  classId?: string,
): Promise<QuestionItem[]> {
  try {
    const session = await getCurrentSession();
    if (!session) return [];

    const where = classId
      ? eq(schema.questions.classId, classId)
      : undefined;

    const rows = await db
      .select({
        id: schema.questions.id,
        askerId: schema.questions.askerId,
        askerName: schema.users.name,
        askerRole: schema.users.role,
        title: schema.questions.title,
        content: schema.questions.content,
        className: schema.classes.name,
        resolvedAt: schema.questions.resolvedAt,
        createdAt: schema.questions.createdAt,
      })
      .from(schema.questions)
      .innerJoin(schema.users, eq(schema.questions.askerId, schema.users.id))
      .leftJoin(schema.classes, eq(schema.questions.classId, schema.classes.id))
      .where(where)
      .orderBy(desc(schema.questions.createdAt))
      .limit(50);

    if (rows.length === 0) return [];

    const questionIds = rows.map((r) => r.id);
    const counts = await db
      .select({
        questionId: schema.answers.questionId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.answers)
      .where(inArray(schema.answers.questionId, questionIds))
      .groupBy(schema.answers.questionId);

    const countMap = new Map(counts.map((c) => [c.questionId, c.count]));

    return rows.map((r) => ({
      ...r,
      answerCount: countMap.get(r.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

/** 查问题详情（含回答列表） */
export async function getQuestionDetail(
  questionId: string,
): Promise<QuestionDetail | null> {
  try {
    const session = await getCurrentSession();
    if (!session) return null;

    const rows = await db
      .select({
        id: schema.questions.id,
        askerId: schema.questions.askerId,
        askerName: schema.users.name,
        askerRole: schema.users.role,
        title: schema.questions.title,
        content: schema.questions.content,
        className: schema.classes.name,
        resolvedAt: schema.questions.resolvedAt,
        createdAt: schema.questions.createdAt,
      })
      .from(schema.questions)
      .innerJoin(schema.users, eq(schema.questions.askerId, schema.users.id))
      .leftJoin(schema.classes, eq(schema.questions.classId, schema.classes.id))
      .where(eq(schema.questions.id, questionId))
      .limit(1);

    if (rows.length === 0) return null;
    const q = rows[0]!;

    const answerRows = await db
      .select({
        id: schema.answers.id,
        answererId: schema.answers.answererId,
        answererName: schema.users.name,
        answererRole: schema.users.role,
        content: schema.answers.content,
        createdAt: schema.answers.createdAt,
      })
      .from(schema.answers)
      .innerJoin(schema.users, eq(schema.answers.answererId, schema.users.id))
      .where(eq(schema.answers.questionId, questionId))
      .orderBy(desc(schema.answers.createdAt));

    return {
      ...q,
      answerCount: answerRows.length,
      answers: answerRows,
    };
  } catch {
    return null;
  }
}

const askSchema = z.object({
  title: z.string().min(2).max(100),
  content: z.string().min(2).max(2000),
  classId: z.string().uuid().optional(),
});

export type AskResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** 提问（学生/家长/教师均可） */
export async function askQuestion(
  input: z.infer<typeof askSchema>,
): Promise<AskResult> {
  try {
    const session = await getCurrentSession();
    if (!session) return { ok: false, error: "未登录" };

    const parsed = askSchema.parse(input);

    const [q] = await db
      .insert(schema.questions)
      .values({
        askerId: session.user.id,
        classId: parsed.classId ?? null,
        title: parsed.title,
        content: parsed.content,
      })
      .returning({ id: schema.questions.id });

    if (!q) return { ok: false, error: "提问失败" };
    return { ok: true, id: q.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "提问失败" };
  }
}

const answerSchema = z.object({
  questionId: z.string().uuid(),
  content: z.string().min(2).max(2000),
});

export type AnswerResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** 回答（教师角色） */
export async function answerQuestion(
  input: z.infer<typeof answerSchema>,
): Promise<AnswerResult> {
  try {
    const session = await getCurrentSession();
    if (!session) return { ok: false, error: "未登录" };
    if (session.user.role !== "teacher" && session.user.role !== "admin") {
      return { ok: false, error: "仅教师可回答" };
    }

    const parsed = answerSchema.parse(input);

    const [a] = await db
      .insert(schema.answers)
      .values({
        questionId: parsed.questionId,
        answererId: session.user.id,
        content: parsed.content,
      })
      .returning({ id: schema.answers.id });

    if (!a) return { ok: false, error: "回答失败" };

    await db
      .update(schema.questions)
      .set({ resolvedAt: new Date() })
      .where(eq(schema.questions.id, parsed.questionId));

    return { ok: true, id: a.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "回答失败" };
  }
}
