import { expect, test } from "@playwright/test";
import {
  accounts,
  CLASS_ONE_CHANNEL,
  loginUi,
  LuminaApi,
  openClassroomChannel,
  unique,
} from "./helpers";

test("未读数在教室 UI 阅读后清零增量并生成已读回执", async ({ page }) => {
  const teacher = await LuminaApi.login(accounts.teacher);
  const classroom = await LuminaApi.login(accounts.classroom);
  const content = unique("未读已读验证");
  try {
    await classroom.confirmAllPending();
    const channel = await teacher.channel(CLASS_ONE_CHANNEL);
    const before = (await classroom.channel(CLASS_ONE_CHANNEL)).unread_count;
    const sent = await teacher.send(channel.id, content);
    await expect.poll(async () => (await classroom.channel(CLASS_ONE_CHANNEL)).unread_count).toBe(before + 1);

    await loginUi(page, accounts.classroom);
    await openClassroomChannel(page);
    const message = page.getByRole("dialog").getByText(content, { exact: true });
    await message.scrollIntoViewIfNeeded();
    await expect(message).toBeVisible();

    await expect.poll(async () => (await classroom.channel(CLASS_ONE_CHANNEL)).unread_count).toBeLessThanOrEqual(before);
    await expect.poll(async () => {
      const history = await teacher.history(channel.id);
      return history.items.find((item) => item.id === sent.id)?.read_count ?? 0;
    }).toBeGreaterThanOrEqual(1);
  } finally {
    await Promise.all([teacher.close(), classroom.close()]);
  }
});
