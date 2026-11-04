import { expect, test } from "@playwright/test";
import { accounts, loginUi, LuminaApi, newContext, unique } from "./helpers";

test("全校紧急公告在两个教室实时阻断并分别确认", async ({ browser }) => {
  const admin = await LuminaApi.login(accounts.admin);
  const firstApi = await LuminaApi.login(accounts.classroom);
  const secondApi = await LuminaApi.login(accounts.secondClassroom);
  await Promise.all([firstApi.confirmAllPending(), secondApi.confirmAllPending()]);
  const content = unique("暴雨紧急停课通知");
  const firstContext = await newContext(browser);
  const secondContext = await newContext(browser);
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await Promise.all([
      loginUi(firstPage, accounts.classroom),
      loginUi(secondPage, accounts.secondClassroom),
    ]);
    const announcement = await admin.createAnnouncement("校园紧急通知", content);
    for (const page of [firstPage, secondPage]) {
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(content, { exact: true })).toBeVisible({ timeout: 5_000 });
      await expect(dialog.getByRole("button", { name: "关闭对话框" })).toHaveCount(0);
      await dialog.getByRole("button", { name: "我已阅读并确认" }).click();
      await expect(dialog).toHaveCount(0);
    }
    for (const api of [firstApi, secondApi]) {
      await expect.poll(async () => {
        const pending = await api.pendingUrgent();
        return pending.announcements.some((item) => item.id === announcement.id);
      }).toBe(false);
    }
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
    await Promise.all([admin.close(), firstApi.close(), secondApi.close()]);
  }
});
