import { expect, test } from "@playwright/test";
import {
  accounts,
  CLASS_ONE_CHANNEL,
  loginUi,
  LuminaApi,
  newContext,
  openClassroomChannel,
  openTeacherChannel,
  unique,
} from "./helpers";

test("教室在大屏回复后教师实时收到并持久化", async ({ browser }) => {
  const teacherApi = await LuminaApi.login(accounts.teacher);
  const classroomApi = await LuminaApi.login(accounts.classroom);
  await classroomApi.confirmAllPending();
  const teacherContext = await newContext(browser);
  const classroomContext = await newContext(browser);
  const teacherPage = await teacherContext.newPage();
  const classroomPage = await classroomContext.newPage();
  const content = unique("教室设备反馈");
  const channel = await teacherApi.channel(CLASS_ONE_CHANNEL);

  try {
    await loginUi(teacherPage, accounts.teacher);
    await loginUi(classroomPage, accounts.classroom);
    await openTeacherChannel(teacherPage);
    await openClassroomChannel(classroomPage);
    const composer = classroomPage.getByRole("textbox", { name: "消息内容" });
    await composer.fill(content);
    await classroomPage.getByRole("button", { name: "发送", exact: true }).click();
    await expect(teacherPage.getByRole("log").getByText(content, { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect.poll(async () => {
      const history = await teacherApi.history(channel.id);
      return history.items.some((message) => message.content === content && message.sender_id === classroomApi.user.id);
    }).toBe(true);
  } finally {
    await Promise.all([teacherContext.close(), classroomContext.close()]);
    await Promise.all([teacherApi.close(), classroomApi.close()]);
  }
});
