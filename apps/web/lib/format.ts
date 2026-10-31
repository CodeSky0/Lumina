const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fullDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : dateTimeFormatter.format(date);
}

export function formatFullDate(date = new Date()): string {
  return fullDateFormatter.format(date);
}

export function formatFileSize(bytes?: number): string {
  if (typeof bytes !== "number" || bytes < 0) return "大小未知";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function readableKey(key: string): string {
  const labels: Record<string, string> = {
    school_name: "学校名称",
    message_retention_days: "消息保留天数",
    allow_file_upload: "允许文件上传",
    emergency_sound_enabled: "紧急提示音",
    announcement_enabled: "公告发布",
    announcement_default_type: "默认公告类型",
    maintenance_mode: "维护模式",
    uploads_enabled: "允许文件上传",
    class_count: "班级总数",
    teacher_count: "教师总数",
    subject_count: "科目总数",
    channel_count: "通道总数",
    message_count: "消息总数",
    online_count: "在线教室",
    classes: "班级总数",
    teachers: "教师总数",
    subjects: "科目总数",
    channels: "通道总数",
    messages_today: "今日消息",
    online_classrooms: "在线教室",
    classrooms: "教室总数",
    assignments: "教学任务数",
    messages: "消息总数",
    announcements: "公告总数",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}
