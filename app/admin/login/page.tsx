import { hasAdmin } from "@/lib/admin/actions";
import AdminLoginForm from "./login-form";

/**
 * 隐藏管理端入口 — 仅手动输入 URL 访问。
 * 首次访问（DB 无 admin）显示注册表单；之后恢复为正常登录。
 */
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const has = await hasAdmin();
  return <AdminLoginForm hasAdmin={has} />;
}
