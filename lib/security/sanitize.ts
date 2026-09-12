/**
 * 输入消毒工具 — 防止 XSS 和注入攻击。
 *
 * 对于用户输入的文本内容，在写入 DB 前进行消毒。
 * React 默认会转义 JSX 中的文本，但存储层消毒是纵深防御。
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

/**
 * 对文本进行 HTML 实体编码，防止 XSS。
 * 保留换行符和空格，仅转义危险字符。
 */
export function sanitizeText(input: string): string {
  return input.replace(/[&<>"'/]/g, (char) => HTML_ENTITY_MAP[char] ?? char);
}

/**
 * 对文本进行基本消毒并限制长度。
 * 去除首尾空白、截断超长内容、移除控制字符。
 */
export function sanitizeAndTruncate(input: string, maxLength: number): string {
  const cleaned = input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .slice(0, maxLength);
  return cleaned;
}

/**
 * 校验文件上传安全性 — 检查文件扩展名和 MIME 类型。
 */
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "scr", "vbs", "js", "jar",
  "php", "asp", "aspx", "jsp", "py", "rb", "pl", "sh",
]);

const DANGEROUS_MIME = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "text/javascript",
  "application/javascript",
]);

export function isFileSafe(filename: string, mimeType: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (DANGEROUS_EXTENSIONS.has(ext)) return false;
  if (DANGEROUS_MIME.has(mimeType.toLowerCase())) return false;
  return true;
}
