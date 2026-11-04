import { expect, test } from "@playwright/test";
import { accounts, CLASS_ONE_CHANNEL, loginUi, LuminaApi, unique } from "./helpers";

test("紧急消息必须由教室确认，刷新不会绕过服务端确认", async ({ page }) => {
  const teacher = await LuminaApi.login(accounts.teacher);
  const classroom = await LuminaApi.login(accounts.classroom);
  const content = unique("紧急确认演练");
  let urgentId = "";
  try {
    await classroom.confirmAllPending();
    const channel = await teacher.channel(CLASS_ONE_CHANNEL);
    const urgent = await teacher.send(channel.id, content, "urgent");
    urgentId = urgent.id;

    await loginUi(page, accounts.classroom);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(content, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "关闭对话框" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "我已阅读并确认" }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => {
      const pending = await classroom.pendingUrgent();
      return pending.messages.some((message) => message.id === urgentId);
    }).toBe(false);

    await page.reload();
    await expect(page.getByText("今天的课堂消息", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await Promise.all([teacher.close(), classroom.close()]);
  }
});
