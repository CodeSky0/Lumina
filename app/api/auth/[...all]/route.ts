import { auth } from "@/lib/auth/server";
import type { NextRequest } from "next/server";

/** Better-Auth API handler — 处理 /api/auth/* 全部认证端点 */
export const GET = (req: NextRequest) => auth.handler(req);
export const POST = (req: NextRequest) => auth.handler(req);
