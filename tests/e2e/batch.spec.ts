import { expect, test } from "@playwright/test";
import {
  accounts,
  CLASS_ONE_CHANNEL,
  CLASS_TWO_CHANNEL,
  loginUi,
  LuminaApi,
  unique,
} from "./helpers";

test("教师 UI 批量通知真实写入两个目标通道", async ({ page }) => {
  const teacher = await LuminaApi.login(accounts.teacher);
  const content = unique("批量通知");
  try {
    const first = await teacher.channel(CLASS_ONE_CHANNEL);
    const second = await teacher.channel(CLASS_TWO_CHANNEL);
    await loginUi(page, accounts.teacher);
    await page.getByRole("button", { name: "批量通知" }).click();
    const dialog = page.getByRole("dialog", { name: "发送批量通知" });
    await dialog.getByRole("checkbox", { name: new RegExp(CLASS_ONE_CHANNEL) }).check();
    await dialog.getByRole("checkbox", { name: new RegExp(CLASS_TWO_CHANNEL) }).check();
    await dialog.getByLabel("通知内容", { exact: true }).fill(content);
    await dialog.getByRole("button", { name: "发送到 2 个通道" }).click();
    await expect(dialog.getByText("逐通道处理结果", { exact: true })).toBeVisible();
    await expect(dialog.getByText("发送成功", { exact: true })).toHaveCount(2);

    for (const channel of [first, second]) {
      await expect.poll(async () => {
        const history = await teacher.history(channel.id);
        return history.items.some((message) => message.content === content && message.type === "notice");
      }).toBe(true);
    }
  } finally {
    await teacher.close();
  }
});
