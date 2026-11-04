import type { Channel, User } from "@/lib/types";

export interface AdminClass {
  id: string;
  name: string;
  grade: number;
  active?: boolean;
  student_count?: number;
  classroom_username?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface TeacherAccount extends User {
  active?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

export interface Subject {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  active?: boolean;
  [key: string]: unknown;
}

export interface AdminChannel extends Channel {
  [key: string]: unknown;
}

export interface Assignment {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  teacher_name?: string;
  class_name?: string;
  subject_name?: string;
  active?: boolean;
  created_at?: string;
}

export type ResourceKind = "classes" | "teachers" | "subjects" | "channels";
export type AdminResource = AdminClass | TeacherAccount | Subject | AdminChannel;
export type SettingsValues = Record<string, string | number | boolean>;
