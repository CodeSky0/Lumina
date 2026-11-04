import { expect, test } from "@playwright/test";
import { accounts, CLASS_ONE_CHANNEL, loginUi, LuminaApi } from "./helpers";

test("管理员通过真实登录页进入管理端", async ({ page }) => {
  await loginUi(page, accounts.admin);
  await expect(page.getByRole("navigation", { name: "管理端导航" })).toBeVisible();
});

test("教师通过真实登录页进入教师工作区", async ({ page }) => {
  await loginUi(page, accounts.teacher);
  await expect(page.getByRole("button", { name: "批量通知" })).toBeVisible();
});

test("教室通过真实登录页进入消息中心", async ({ page }) => {
  const api = await LuminaApi.login(accounts.classroom);
  try {
    await api.confirmAllPending();
  } finally {
    await api.close();
  }
  await loginUi(page, accounts.classroom);
  await expect(page.getByText("教室消息中心", { exact: true })).toBeVisible();
});

test("前端角色守卫阻止教师进入管理端", async ({ page }) => {
  await loginUi(page, accounts.teacher);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByText("教师工作区", { exact: true })).toBeVisible();
});

test("服务端拒绝跨角色管理接口和跨班消息读取", async () => {
  const teacher = await LuminaApi.login(accounts.teacher);
  const first = await LuminaApi.login(accounts.classroom);
  const second = await LuminaApi.login(accounts.secondClassroom);
  try {
    const adminResponse = await teacher.rawGet("/api/v1/admin/dashboard");
    expect(adminResponse.status()).toBe(403);
    expect((await adminResponse.json()).error.code).toBe("ROLE_FORBIDDEN");

    const classOneChannel = await first.channel(CLASS_ONE_CHANNEL);
    const historyResponse = await second.rawGet(`/api/v1/channels/${classOneChannel.id}/messages`);
    expect(historyResponse.status()).toBe(403);
  } finally {
    await Promise.all([teacher.close(), first.close(), second.close()]);
  }
});
