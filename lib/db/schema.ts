/**
 * Lumina 数据库 Schema (Drizzle ORM + PostgreSQL)
 *
 * 认证：Better-Auth (username + password plugin) 复用 users 表作为其 user 表。
 *   - 登录 ID → username（UUID 字符串），Token → password（better-auth 哈希存 accounts.password）
 *   - users.tokenHash 另存 Token 的 SHA-256，作为规格要求的审计/自定义校验冗余字段
 *   - usePlural: true → better-auth 表名为 users/accounts/sessions/verifications
 *
 * 业务表关系：
 *   users ─┬─ teacher_classes ─── classes
 *          ├─ parent_students  ─── classes (含 student_name)
 *          ├─ classes.screen_id (大屏 1:1 绑定班级)
 *          └─ messages.sender_id
 *   classes ─── messages.target_class_id
 *
 * 权限约束（Server Action 层强制，见 lib/rbac.ts）：
 *   - 家长仅能向 parent_students 中自己关联的 class_id 发消息
 *   - 教师仅能向 teacher_classes 中自己关联的 class_id 发消息
 *   - 大屏仅订阅 class-{own_class_id} WS 房间
 */
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* 枚举                                                                        */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum("user_role", [
  "parent",
  "teacher",
  "classroom",
  "admin",
]);

export const messageTypeEnum = pgEnum("message_type", ["text", "image", "urgent", "file", "audio"]);

export const messageStatusEnum = pgEnum("message_status", [
  "pending",
  "delivered",
  "displayed",
]);

export const conversationTypeEnum = pgEnum("conversation_type", [
  "group",
  "direct",
]);

/* -------------------------------------------------------------------------- */
/* users — 同时作为 Better-Auth 的 user 表 (usePlural)                          */
/*   id 用 text 存 UUID 字符串，以兼容 better-auth 的默认 id 类型               */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** 占位 email（better-auth user 必需字段），格式 {id}@lumina.local，不用于登录 */
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  /** username plugin：登录 ID（角色前缀+6位短码，如 T-A3X9K2） */
  username: text("username").notNull().unique(),
  displayUsername: text("display_username"),
  /* ---- Lumina 业务字段 ---- */
  role: userRoleEnum("role").notNull().default("parent"),
  /** 登录 Token 的 SHA-256 哈希（审计/自定义校验冗余；密码主校验由 better-auth accounts.password 承担） */
  tokenHash: text("token_hash").notNull().default(""),
});

export const usersRelations = relations(users, ({ many }) => ({
  teachingClasses: many(teacherClasses),
  children: many(parentStudents),
  sentMessages: many(messages),
  classroomFor: many(classes),
  accounts: many(accounts),
  sessions: many(sessions),
}));

/* -------------------------------------------------------------------------- */
/* accounts — Better-Auth account 表 (usePlural)                                */
/* -------------------------------------------------------------------------- */

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  accountId: text("account_id").notNull(),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* sessions — Better-Auth session 表 (usePlural)                                */
/* -------------------------------------------------------------------------- */

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* verifications — Better-Auth verification 表 (usePlural)                      */
/* -------------------------------------------------------------------------- */

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* -------------------------------------------------------------------------- */
/* classes                                                                     */
/* -------------------------------------------------------------------------- */

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    /** 绑定的大屏用户 id，UNIQUE 保证一班一屏 */
    screenId: text("screen_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("classes_screen_id_unique").on(t.screenId)],
);

export const classesRelations = relations(classes, ({ one, many }) => ({
  screen: one(users, {
    fields: [classes.screenId],
    references: [users.id],
  }),
  teachers: many(teacherClasses),
  students: many(parentStudents),
  messages: many(messages),
  groupConversations: many(conversations),
}));

/* -------------------------------------------------------------------------- */
/* conversations — 会话（班级群聊 / 私信）                                      */
/* -------------------------------------------------------------------------- */

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: conversationTypeEnum("type").notNull(),
    /** 群聊时关联班级 */
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "cascade",
    }),
    /** 私信时参与者A（通常为教师） */
    participantAId: text("participant_a_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    /** 私信时参与者B（通常为家长） */
    participantBId: text("participant_b_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("conversations_class_idx").on(t.classId),
    index("conversations_participant_a_idx").on(t.participantAId),
    index("conversations_participant_b_idx").on(t.participantBId),
  ],
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  class: one(classes, {
    fields: [conversations.classId],
    references: [classes.id],
  }),
  participantA: one(users, {
    fields: [conversations.participantAId],
    references: [users.id],
    relationName: "conversationParticipantA",
  }),
  participantB: one(users, {
    fields: [conversations.participantBId],
    references: [users.id],
    relationName: "conversationParticipantB",
  }),
  messages: many(messages),
}));

/* -------------------------------------------------------------------------- */
/* teacher_classes — 教师 ↔ 班级 多对多                                         */
/* -------------------------------------------------------------------------- */

export const teacherClasses = pgTable(
  "teacher_classes",
  {
    teacherId: text("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.teacherId, t.classId] })],
);

export const teacherClassesRelations = relations(teacherClasses, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherClasses.teacherId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [teacherClasses.classId],
    references: [classes.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* parent_students — 家长 ↔ 班级（含学生姓名）                                  */
/* -------------------------------------------------------------------------- */

export const parentStudents = pgTable(
  "parent_students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: text("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentName: text("student_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("parent_student_unique").on(
      t.parentId,
      t.classId,
      t.studentName,
    ),
  ],
);

export const parentStudentsRelations = relations(parentStudents, ({ one }) => ({
  parent: one(users, {
    fields: [parentStudents.parentId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [parentStudents.classId],
    references: [classes.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* messages                                                                    */
/*   content: 文本内容 或 Vercel Blob URL（type=image 时）                       */
/* -------------------------------------------------------------------------- */

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    type: messageTypeEnum("type").notNull(),
    /** type=image 时记录 MIME（如 image/webp）；文本消息为 null */
    mimeType: text("mime_type"),
    status: messageStatusEnum("status").default("pending").notNull(),
    /** 撤回时间，null 表示未撤回 */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** 最后编辑时间，null 表示未编辑 */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /** 编辑历史：[{ content, editedAt }] */
    editHistory: jsonb("edit_history").$type<{ content: string; editedAt: string }[]>(),
    /** @提及列表：[{ userId, name }] */
    mentions: jsonb("mentions").$type<{ userId: string; name: string }[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId),
    index("messages_created_at_idx").on(t.createdAt),
  ],
);

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* message_reads — 用户 × 会话 的已读位置（未读计数支持）                       */
/* -------------------------------------------------------------------------- */

export const messageReads = pgTable(
  "message_reads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.conversationId] })],
);

export const messageReadsRelations = relations(messageReads, ({ one }) => ({
  user: one(users, {
    fields: [messageReads.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [messageReads.conversationId],
    references: [conversations.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* conversation_preferences — 用户对会话的偏好（置顶/免打扰）                    */
/* -------------------------------------------------------------------------- */

export const conversationPreferences = pgTable(
  "conversation_preferences",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    pinned: boolean("pinned").default(false).notNull(),
    muted: boolean("muted").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.conversationId] })],
);

export const conversationPreferencesRelations = relations(
  conversationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [conversationPreferences.userId],
      references: [users.id],
    }),
    conversation: one(conversations, {
      fields: [conversationPreferences.conversationId],
      references: [conversations.id],
    }),
  }),
);

/* -------------------------------------------------------------------------- */
/* notifications — 通知中心                                                    */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_created_at_idx").on(t.createdAt),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [notifications.conversationId],
    references: [conversations.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* push_subscriptions — 浏览器 Web Push 订阅                                   */
/* -------------------------------------------------------------------------- */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("push_subscriptions_user_idx").on(t.userId),
    uniqueIndex("push_subscriptions_endpoint_unique").on(t.endpoint),
  ],
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

/* -------------------------------------------------------------------------- */
/* announcements — 班级公告                                                    */
/* -------------------------------------------------------------------------- */

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("announcements_class_idx").on(t.classId),
    index("announcements_created_at_idx").on(t.createdAt),
  ],
);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  class: one(classes, {
    fields: [announcements.classId],
    references: [classes.id],
  }),
  creator: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* audit_logs — 操作审计日志                                                   */
/* -------------------------------------------------------------------------- */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* 派生类型导出                                                                */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export type TeacherClass = typeof teacherClasses.$inferSelect;
export type ParentStudent = typeof parentStudents.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type MessageType = (typeof messageTypeEnum.enumValues)[number];
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number];
export type ConversationType = (typeof conversationTypeEnum.enumValues)[number];
