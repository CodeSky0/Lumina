import { expect, test } from "@playwright/test";
import { accounts, CLASS_ONE_CHANNEL, LuminaApi, unique } from "./helpers";

test("同通道并发消息持久化无丢失且按 ID 严格排序", async () => {
  const teacher = await LuminaApi.login(accounts.teacher);
  const prefix = unique("并发消息");
  const count = 12;
  try {
    const channel = await teacher.channel(CLASS_ONE_CHANNEL);
    await Promise.all(Array.from({ length: count }, (_, index) =>
      teacher.send(channel.id, `${prefix}-${index}`),
    ));

    const history = await teacher.history(channel.id, 100);
    const persisted = history.items.filter((message) => message.content.startsWith(prefix));
    expect(persisted).toHaveLength(count);
    expect(new Set(persisted.map((message) => message.id)).size).toBe(count);
    expect(new Set(persisted.map((message) => message.content)).size).toBe(count);
    for (let index = 1; index < persisted.length; index += 1) {
      expect(BigInt(persisted[index - 1].id) > BigInt(persisted[index].id)).toBe(true);
    }
  } finally {
    await teacher.close();
  }
});
