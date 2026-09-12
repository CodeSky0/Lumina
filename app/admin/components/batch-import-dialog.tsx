"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Dialog, Button, useToast } from "@/components/ui";
import {
  batchCreateTeachers,
  batchCreateStudents,
  type BatchResultItem,
} from "@/lib/admin/actions";

type ImportMode = "teacher" | "student";

interface BatchImportDialogProps {
  open: boolean;
  mode: ImportMode;
  onClose: () => void;
  onComplete: (results: BatchResultItem[]) => void;
}

const TEACHER_PLACEHOLDER = "姓名,班级名\n张老师,一年级一班\n李老师,一年级一班\n王老师,二年级一班";

const STUDENT_PLACEHOLDER =
  "学生姓名,家长姓名,班级名\n小明,张三,一年级一班\n小红,张三,一年级一班\n小华,李四,二年级一班";

export function BatchImportDialog({
  open,
  mode,
  onClose,
  onComplete,
}: BatchImportDialogProps) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();

  const placeholder =
    mode === "teacher" ? TEACHER_PLACEHOLDER : STUDENT_PLACEHOLDER;

  function parseInput(): { valid: boolean; rows: Record<string, string>[]; error?: string } {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { valid: false, rows: [], error: "请输入数据" };

    const hasHeader = lines[0]!.includes(",");
    const rows: Record<string, string>[] = [];

    if (hasHeader) {
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      rows.push(...parsed.data);
    } else {
      if (mode === "teacher") {
        for (const line of lines) {
          const parts = line.split(",").map((s) => s.trim());
          rows.push({ 姓名: parts[0] ?? "", 班级名: parts[1] ?? "" });
        }
      } else {
        for (const line of lines) {
          const parts = line.split(",").map((s) => s.trim());
          rows.push({
            学生姓名: parts[0] ?? "",
            家长姓名: parts[1] ?? "",
            班级名: parts[2] ?? "",
          });
        }
      }
    }

    if (mode === "teacher") {
      for (const row of rows) {
        if (!row["姓名"]) return { valid: false, rows: [], error: "每行必须包含姓名" };
      }
    } else {
      for (const row of rows) {
        if (!row["学生姓名"] || !row["家长姓名"] || !row["班级名"]) {
          return { valid: false, rows: [], error: "每行必须包含学生姓名、家长姓名、班级名" };
        }
      }
    }

    return { valid: true, rows };
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(String(ev.target?.result ?? ""));
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImport() {
    const { valid, rows, error } = parseInput();
    if (!valid) {
      show("error", error ?? "数据格式错误");
      return;
    }

    setPending(true);
    try {
      let results: BatchResultItem[];
      if (mode === "teacher") {
        results = await batchCreateTeachers({
          items: rows.map((r) => ({
            name: r["姓名"] ?? "",
            className: r["班级名"] || undefined,
          })),
        });
      } else {
        results = await batchCreateStudents({
          items: rows.map((r) => ({
            studentName: r["学生姓名"] ?? "",
            parentName: r["家长姓名"] ?? "",
            className: r["班级名"] ?? "",
          })),
        });
      }
      const successCount = results.filter((r) => !r.error).length;
      const errorCount = results.filter((r) => r.error).length;
      show(
        successCount > 0 ? "success" : "error",
        `成功创建 ${successCount} 个用户${errorCount > 0 ? `，${errorCount} 个失败` : ""}`,
      );
      onComplete(results);
      setText("");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "导入失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "teacher" ? "批量导入教师" : "批量导入学生"}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-label-12 font-medium text-neutral-7">
              {mode === "teacher"
                ? "每行：姓名,班级名（班级名可选）"
                : "每行：学生姓名,家长姓名,班级名"}
            </span>
            <label className="cursor-pointer text-label-12 text-accent underline">
              上传 CSV 文件
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={10}
            className="w-full rounded-md bg-neutral-1 px-3 py-2 font-mono text-copy-13 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={pending || !text.trim()}>
            {pending ? "导入中…" : "开始导入"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
