import { describe, it, expect } from "vitest";

type Mention = { userId: string; name: string };

function parseMentions(raw: string | null | undefined): Mention[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is Mention =>
          typeof m === "object" &&
          m !== null &&
          typeof m.userId === "string" &&
          typeof m.name === "string",
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

function filterActiveMentions(
  text: string,
  mentions: Mention[],
): Mention[] {
  return mentions.filter((m) => text.includes(`@${m.name}`));
}

describe("parseMentions", () => {
  it("returns empty array for null/undefined/empty", () => {
    expect(parseMentions(null)).toEqual([]);
    expect(parseMentions(undefined)).toEqual([]);
    expect(parseMentions("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseMentions("not json")).toEqual([]);
    expect(parseMentions("{")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseMentions('{"a":1}')).toEqual([]);
    expect(parseMentions('"hello"')).toEqual([]);
    expect(parseMentions("42")).toEqual([]);
  });

  it("parses valid mentions array", () => {
    const raw = JSON.stringify([
      { userId: "u1", name: "张老师" },
      { userId: "u2", name: "李家长" },
    ]);
    expect(parseMentions(raw)).toEqual([
      { userId: "u1", name: "张老师" },
      { userId: "u2", name: "李家长" },
    ]);
  });

  it("filters out invalid entries", () => {
    const raw = JSON.stringify([
      { userId: "u1", name: "张老师" },
      { userId: 123, name: "无效" },
      { name: "无userId" },
      null,
      "string",
      { userId: "u2", name: "李家长" },
    ]);
    expect(parseMentions(raw)).toEqual([
      { userId: "u1", name: "张老师" },
      { userId: "u2", name: "李家长" },
    ]);
  });

  it("limits to 50 mentions", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      userId: `u${i}`,
      name: `用户${i}`,
    }));
    expect(parseMentions(JSON.stringify(many))).toHaveLength(50);
  });
});

describe("filterActiveMentions", () => {
  it("returns mentions that appear in text", () => {
    const mentions: Mention[] = [
      { userId: "u1", name: "张老师" },
      { userId: "u2", name: "李家长" },
    ];
    const text = "你好 @张老师 请看一下";
    expect(filterActiveMentions(text, mentions)).toEqual([
      { userId: "u1", name: "张老师" },
    ]);
  });

  it("returns empty when no mentions in text", () => {
    const mentions: Mention[] = [
      { userId: "u1", name: "张老师" },
    ];
    expect(filterActiveMentions("普通消息", mentions)).toEqual([]);
  });

  it("handles multiple mentions in text", () => {
    const mentions: Mention[] = [
      { userId: "u1", name: "张老师" },
      { userId: "u2", name: "李家长" },
    ];
    const text = "@张老师 @李家长 你们好";
    expect(filterActiveMentions(text, mentions)).toEqual(mentions);
  });
});
