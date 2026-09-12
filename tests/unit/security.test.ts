import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, cleanupRateLimit } from "@/lib/security/rate-limit";
import { sanitizeText, sanitizeAndTruncate, isFileSafe } from "@/lib/security/sanitize";

describe("rateLimit", () => {
  beforeEach(() => {
    cleanupRateLimit();
  });

  it("allows requests within limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = rateLimit("test-key", 5, 60_000);
      expect(result.ok).toBe(true);
    }
  });

  it("blocks requests exceeding limit", () => {
    for (let i = 0; i < 3; i++) {
      rateLimit("block-key", 3, 60_000);
    }
    const result = rateLimit("block-key", 3, 60_000);
    expect(result.ok).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    rateLimit("key-a", 1, 60_000);
    expect(rateLimit("key-a", 1, 60_000).ok).toBe(false);
    expect(rateLimit("key-b", 1, 60_000).ok).toBe(true);
  });

  it("resets after window expires", () => {
    rateLimit("reset-key", 1, 0);
    const result = rateLimit("reset-key", 1, 0);
    expect(result.ok).toBe(true);
  });
});

describe("sanitizeText", () => {
  it("escapes HTML special characters", () => {
    expect(sanitizeText("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;",
    );
  });

  it("escapes quotes and ampersand", () => {
    expect(sanitizeText('"a" & \'b\'')).toBe("&quot;a&quot; &amp; &#x27;b&#x27;");
  });

  it("preserves safe characters", () => {
    expect(sanitizeText("Hello World 123")).toBe("Hello World 123");
  });
});

describe("sanitizeAndTruncate", () => {
  it("trims whitespace", () => {
    expect(sanitizeAndTruncate("  hello  ", 100)).toBe("hello");
  });

  it("truncates to maxLength", () => {
    expect(sanitizeAndTruncate("abcdef", 3)).toBe("abc");
  });

  it("removes control characters", () => {
    expect(sanitizeAndTruncate("a\x00b\x07c", 100)).toBe("abc");
  });

  it("handles empty input", () => {
    expect(sanitizeAndTruncate("", 100)).toBe("");
  });
});

describe("isFileSafe", () => {
  it("allows safe files", () => {
    expect(isFileSafe("photo.jpg", "image/jpeg")).toBe(true);
    expect(isFileSafe("doc.pdf", "application/pdf")).toBe(true);
    expect(isFileSafe("voice.webm", "audio/webm")).toBe(true);
  });

  it("blocks dangerous extensions", () => {
    expect(isFileSafe("malware.exe", "application/x-msdownload")).toBe(false);
    expect(isFileSafe("script.js", "text/javascript")).toBe(false);
    expect(isFileSafe("app.jar", "application/java-archive")).toBe(false);
  });

  it("blocks dangerous MIME types", () => {
    expect(isFileSafe("file.txt", "application/x-msdownload")).toBe(false);
    expect(isFileSafe("file.txt", "text/javascript")).toBe(false);
  });
});
