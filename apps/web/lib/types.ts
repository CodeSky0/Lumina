export type Role = "admin" | "teacher" | "classroom";

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  class_id?: string;
}

export interface AuthSession {
  access_token: string;
  user: User;
  expires_at: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  request_id: string;
}

export interface DataEnvelope<T> {
  data: T;
}

export interface ListData<T> {
  items?: T[];
  data?: T[];
  results?: T[];
  total?: number;
  page?: number;
  size?: number;
  total_pages?: number;
}

export type ListResult<T> = T[] | ListData<T>;

export type ChannelType = "normal" | "broadcast" | string;

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  class_id?: string;
  subject_id?: string;
  teacher_id?: string;
  broadcast_scope?: "school" | "grade" | "class";
  target_class_id?: string;
  active: boolean;
  class_name?: string;
  grade?: number;
  subject_name?: string;
  subject_icon?: string;
  subject_color?: string;
  teacher_name?: string;
  last_message?: Message;
  unread_count: number;
  online?: boolean;
}

export type MessageType = "text" | "notice" | "urgent" | "image" | "file" | "system";

export interface MessageMetadata {
  file_id?: string;
  file_name?: string;
  mime_type?: string;
  size?: number;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  channel_id: string;
  channel_name?: string;
  sender_id: string;
  sender_name: string;
  client_msg_id?: string;
  type: MessageType;
  content: string;
  metadata: MessageMetadata;
  reply_to_id?: string;
  is_pinned: boolean;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  delivery_count?: number;
  read_count: number;
  confirmed_at?: string;
  delivery_state?: "sending" | "failed";
  retryable?: boolean;
  error?: string;
}

export interface MessagePageData {
  items?: Message[];
  messages?: Message[];
  data?: Message[];
  has_more?: boolean;
  next_before_id?: string;
}

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface Upload {
  id: string;
  original_name: string;
  mime: string;
  size: number;
  kind: "image" | "file";
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "notice" | "urgent";
  scope: "school" | "grade" | "class";
  grade?: number;
  target_class_id?: string;
  publisher_id: string;
  publisher_name: string;
  created_at: string;
  confirmed_at?: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: unknown;
  ip_address?: string;
  created_at: string;
}

export interface BatchNoticeResult {
  channel_id: string;
  success: boolean;
  message?: Message;
  code?: string;
  error?: string;
}

export interface UrgentPendingData {
  messages?: Message[];
  announcements?: Announcement[];
  items?: Array<Message | Announcement>;
}

export type RealtimeEventType =
  | "new_message"
  | "message_edited"
  | "message_deleted"
  | "announcement"
  | "announcement_invalidated"
  | "typing"
  | "presence"
  | "read_ack"
  | "delivery_ack"
  | "server_shutdown"
  | "urgent_confirmed";

export interface RealtimeEvent<T = unknown> {
  event_id: string;
  type: RealtimeEventType;
  channel_id?: string;
  occurred_at: string;
  data: T;
}
