/**
 * Sentry 监控 instrumentation — 可选加载。
 *
 * 启用方式：
 *   1. npm install @sentry/nextjs
 *   2. 设置环境变量 SENTRY_DSN
 *   3. 取消下方代码注释
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.SENTRY_DSN) {
      // const Sentry = await import("@sentry/nextjs");
      // Sentry.init({
      //   dsn: process.env.SENTRY_DSN,
      //   tracesSampleRate: 0.1,
      //   environment: process.env.NODE_ENV,
      // });
    }
  }
}
