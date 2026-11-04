import { expect, test } from "@playwright/test";
import {
  accounts,
  loginUi,
  LuminaApi,
  newContext,
  openClassroomChannel,
  openTeacherChannel,
  unique,
} from "./helpers";

test("两个独立浏览器实时收消息，刷新后从数据库恢复", async ({ browser }) => {
  const classroomApi = await LuminaApi.login(accounts.classroom);
  await classroomApi.confirmAllPending();

  const secondBrowser = await browser.browserType().launch();
  const teacherContext = await newContext(browser);
  const classroomContext = await newContext(secondBrowser);
  const teacherPage = await teacherContext.newPage();
  const classroomPage = await classroomContext.newPage();
  const content = unique("双浏览器实时消息");

  try {
    await loginUi(teacherPage, accounts.teacher);
    await loginUi(classroomPage, accounts.classroom);
    await openTeacherChannel(teacherPage);
    await openClassroomChannel(classroomPage);
    await expect(teacherPage.getByText("实时连接正常", { exact: true })).toBeVisible();
    await expect(classroomPage.getByText("实时连接正常", { exact: true })).toBeVisible();

    await teacherPage.getByRole("textbox", { name: "消息内容" }).fill(content);
    await teacherPage.getByRole("button", { name: "发送", exact: true }).click();
    await expect(classroomPage.getByRole("dialog").getByText(content, { exact: true })).toBeVisible({ timeout: 5_000 });

    await classroomPage.reload();
    await expect(classroomPage.getByText("今天的课堂消息", { exact: true })).toBeVisible();
    await openClassroomChannel(classroomPage);
    const persisted = classroomPage.getByRole("dialog").getByText(content, { exact: true });
    await persisted.scrollIntoViewIfNeeded();
    await expect(persisted).toBeVisible();
  } finally {
    await Promise.all([teacherContext.close(), classroomContext.close()]);
    await secondBrowser.close();
    await classroomApi.close();
  }
});
