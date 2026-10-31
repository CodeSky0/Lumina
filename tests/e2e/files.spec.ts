import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  accounts,
  CLASS_ONE_CHANNEL,
  loginUi,
  LuminaApi,
  openClassroomChannel,
  unique,
} from "./helpers";

test("真实 multipart 文件上传、鉴权下载及教室 UI 下载保持一致", async ({ page }) => {
  const teacher = await LuminaApi.login(accounts.teacher);
  const classroom = await LuminaApi.login(accounts.classroom);
  const otherClassroom = await LuminaApi.login(accounts.secondClassroom);
  const filename = `${unique("课程资料")}.txt`;
  const content = Buffer.from(`Lumina 文件往返验证\n${filename}\n`, "utf8");
  try {
    await classroom.confirmAllPending();
    const channel = await teacher.channel(CLASS_ONE_CHANNEL);
    const upload = await teacher.upload(channel.id, filename, content);
    await teacher.send(channel.id, filename, "file", {
      file_id: upload.id,
      file_name: filename,
      mime_type: upload.mime,
      size: upload.size,
    });

    const downloaded = await teacher.download(upload.id);
    expect(downloaded.body.equals(content)).toBe(true);
    expect(downloaded.contentType).toContain("text/plain");
    expect((await otherClassroom.rawGet(`/api/v1/files/${upload.id}`)).status()).toBe(403);

    await loginUi(page, accounts.classroom);
    await openClassroomChannel(page);
    const button = page.getByRole("button", { name: `下载 ${filename}`, exact: true });
    await button.scrollIntoViewIfNeeded();
    const downloadEvent = page.waitForEvent("download");
    await button.click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(filename);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    expect((await readFile(downloadPath!)).equals(content)).toBe(true);
  } finally {
    await Promise.all([teacher.close(), classroom.close(), otherClassroom.close()]);
  }
});
