/**
 * 路由保护代理 (Next.js 16 proxy 约定) — 粗粒度校验：
 *   - 公开路由放行（/login, /admin/login, /api/auth/*, 静态资源）
 *   - 其余路由要求存在 Better-Auth 会话 Cookie，否则重定向至 /login
 *
 * 角色细粒度（parent/teacher/classroom/admin）由各端 Server Component/Server Action
 * 通过 getCurrentSession() 查 DB 校验，proxy 不查 DB 以保持 Edge 低延迟。
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/admin/login", "/api/setup"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Better-Auth API 端点放行
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 公开页面放行
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // 受保护路由：检查会话 Cookie 存在性
  const sessionCookie = getSessionCookie(req);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 匹配所有路由，排除静态资源与 Next 内部
    "/((?!_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
};
