import { expect, test } from "@playwright/test";
import {
  accounts,
  loginUi,
  nginx,
  openTeacherChannel,
  unique,
  waitForReady,
} from "./helpers";

test("Nginx 断线后浏览器自动重连并继续真实消息收发", async ({ page }) => {
  test.setTimeout(240_000);
  await loginUi(page, accounts.teacher);
  await openTeacherChannel(page);
  await expect(page.getByText("实时连接正常", { exact: true })).toBeVisible();

  try {
    await nginx("stop");
    await expect(page.getByText("正在恢复连接", { exact: true })).toBeVisible({ timeout: 20_000 });
    await nginx("start");
    await waitForReady(45_000);
    await expect(page.getByText("实时连接正常", { exact: true })).toBeVisible({ timeout: 45_000 });

    const content = unique("断线重连后消息");
    await page.getByRole("textbox", { name: "消息内容" }).fill(content);
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await expect(page.getByRole("log").getByText(content, { exact: true })).toBeVisible();
  } finally {
    await nginx("start");
  }
});
