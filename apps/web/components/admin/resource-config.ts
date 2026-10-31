import type { ResourceKind } from "@/lib/admin";

export interface FieldOption { value: string; label: string }
export interface FieldDefinition {
  name: string;
  label: string;
  type: "text" | "number" | "password" | "select" | "color" | "checkbox";
  required?: boolean;
  requiredOnCreate?: boolean;
  createOnly?: boolean;
  recordKey?: string;
  helper?: string;
  options?: FieldOption[];
  lookup?: "classes" | "teachers" | "subjects";
}

export interface ResourceConfig {
  title: string;
  singular: string;
  description: string;
  endpoint: string;
  fields: FieldDefinition[];
  columns: Array<{ key: string; label: string }>;
}

export const RESOURCE_CONFIGS: Record<ResourceKind, ResourceConfig> = {
  classes: {
    title: "班级管理", singular: "班级", description: "维护年级与班级档案，新增班级时同时设置教室登录凭据。", endpoint: "/api/v1/admin/classes",
    fields: [
      { name: "name", label: "班级名称", type: "text", required: true },
      { name: "grade", label: "年级", type: "number", required: true },
      { name: "classroom_username", label: "教室账号", type: "text", requiredOnCreate: true, createOnly: true },
      { name: "classroom_password", label: "教室密码", type: "password", requiredOnCreate: true, createOnly: true, helper: "密码需为 12–72 个字符，仅新增班级时设置。" },
      { name: "active", label: "启用班级", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "班级名称" }, { key: "grade", label: "年级" }, { key: "active", label: "状态" }],
  },
  teachers: {
    title: "教师管理", singular: "教师", description: "管理教师账号、显示姓名与有效状态，密码仅在提交时传输。", endpoint: "/api/v1/admin/teachers",
    fields: [
      { name: "username", label: "用户名", type: "text", required: true },
      { name: "display_name", label: "显示姓名", type: "text", required: true },
      { name: "password", label: "登录密码", type: "password", requiredOnCreate: true, helper: "编辑时留空表示不修改密码。" },
      { name: "active", label: "允许登录", type: "checkbox" },
    ],
    columns: [{ key: "display_name", label: "姓名" }, { key: "username", label: "用户名" }, { key: "active", label: "状态" }],
  },
  subjects: {
    title: "科目管理", singular: "科目", description: "统一科目名称与大屏图标、色彩，颜色用于识别而非装饰光效。", endpoint: "/api/v1/admin/subjects",
    fields: [
      { name: "name", label: "科目名称", type: "text", required: true },
      { name: "icon", label: "图标标识", type: "text", required: true, helper: "支持 book、math、science、globe、computer、music、art、sports。" },
      { name: "color", label: "识别颜色", type: "color" },
      { name: "active", label: "启用科目", type: "checkbox" },
    ],
    columns: [{ key: "name", label: "科目名称" }, { key: "icon", label: "图标标识" }, { key: "color", label: "识别颜色" }, { key: "active", label: "状态" }],
  },
  channels: {
    title: "通道管理", singular: "广播通道", description: "创建全校、年级或班级广播；科目通道请通过教学任务分配统一维护。", endpoint: "/api/v1/admin/channels",
    fields: [
      { name: "name", label: "通道名称", type: "text", required: true },
      { name: "scope", label: "广播范围", type: "select", required: true, recordKey: "broadcast_scope", options: [{ value: "school", label: "全校" }, { value: "grade", label: "指定年级" }, { value: "class", label: "指定班级" }] },
      { name: "grade", label: "目标年级", type: "number" },
      { name: "target_class_id", label: "目标班级", type: "select", lookup: "classes" },
      { name: "active", label: "启用通道", type: "checkbox" },
    ],
    columns: [
      { key: "name", label: "通道名称" }, { key: "type", label: "类型" },
      { key: "class_id", label: "班级" }, { key: "subject_id", label: "科目" }, { key: "teacher_id", label: "教师" },
      { key: "broadcast_scope", label: "广播范围" }, { key: "grade", label: "年级" }, { key: "target_class_id", label: "目标班级" }, { key: "active", label: "状态" },
    ],
  },
};
