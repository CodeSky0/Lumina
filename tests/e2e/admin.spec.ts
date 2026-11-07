import { expect, test } from "@playwright/test";
import { accounts, LuminaApi, unique } from "./helpers";

test("管理员创建班级教师并分配任务后自动生成唯一通道", async () => {
  const admin = await LuminaApi.login(accounts.admin);
  const suffix = unique("e2e").replaceAll("-", "");
  let classId = "";
  let teacherId = "";
  let assignmentId = "";
  let channelId = "";
  let teacherSession: LuminaApi | undefined;
  try {
    const classroom = await admin.adminWrite<{ id: string; name: string }>("POST", "/api/v1/admin/classes", {
      name: `验收班级${suffix}`,
      grade: 1,
      classroom_username: `room${suffix}`,
      classroom_password: "Classroom@2026Lumina",
      active: true,
    });
    classId = classroom.id;
    const subjects = await admin.adminList<{ items: Array<{ id: string; name: string }> }>("/api/v1/admin/subjects?page=1&size=1");
    const subject = subjects.items[0];
    const teacher = await admin.adminWrite<{ id: string; display_name: string; subject_id: string }>("POST", "/api/v1/admin/teachers", {
      username: `trainer${suffix}`,
      display_name: "验收教师",
      password: "Teacher@2026Lumina",
      subject_id: subject.id,
      active: true,
    });
    teacherId = teacher.id;
    expect(teacher.subject_id).toBe(subject.id);
    const assignment = await admin.adminWrite<{ id: string }>("POST", "/api/v1/admin/assignments", {
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subject.id,
      active: true,
    });
    assignmentId = assignment.id;

    teacherSession = await LuminaApi.login({ username: `trainer${suffix}`, password: "Teacher@2026Lumina", role: "teacher", destination: "/teacher" });
    const channels = await teacherSession.channels();
    const generated = channels.find((item) => item.name === `${classroom.name} · ${subject.name} · 验收教师`);
    expect(generated).toBeDefined();
    channelId = generated!.id;
  } finally {
    if (assignmentId) await admin.adminWrite("DELETE", `/api/v1/admin/assignments/${assignmentId}`);
    if (channelId) await admin.adminWrite("DELETE", `/api/v1/admin/channels/${channelId}`);
    if (teacherId) await admin.adminWrite("DELETE", `/api/v1/admin/teachers/${teacherId}`);
    if (classId) await admin.adminWrite("DELETE", `/api/v1/admin/classes/${classId}`);
    await teacherSession?.close();
    await admin.close();
  }
});
