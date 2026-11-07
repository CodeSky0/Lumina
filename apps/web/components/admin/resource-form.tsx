"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ResourceKind } from "@/lib/admin";
import { RESOURCE_CONFIGS, type FieldDefinition } from "@/components/admin/resource-config";
import type { useAdminLookups } from "@/components/admin/use-admin-lookups";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/async-state";

export type ResourceRow = { id: string; [key: string]: unknown };
type FormValue = string | boolean;
type Lookups = ReturnType<typeof useAdminLookups>;

function editableFields(kind: ResourceKind, isEdit: boolean): FieldDefinition[] {
  return RESOURCE_CONFIGS[kind].fields.filter((field) => !(isEdit && field.createOnly));
}

function relevantFields(kind: ResourceKind, values: Record<string, FormValue>, isEdit: boolean): FieldDefinition[] {
  return editableFields(kind, isEdit).filter((field) => {
    if (kind !== "channels") return true;
    if (field.name === "grade") return values.scope === "grade";
    if (field.name === "target_class_id") return values.scope === "class";
    return true;
  });
}

export function validateResource(kind: ResourceKind, values: Record<string, FormValue>, isEdit: boolean): string | null {
  for (const field of relevantFields(kind, values, isEdit)) {
    const value = values[field.name];
    if ((field.required || (field.requiredOnCreate && !isEdit)) && (value === undefined || (typeof value === "string" && !value.trim()))) {
      return `请填写${field.label}`;
    }
  }
  const grade = values.grade;
  if ((kind === "classes" || (kind === "channels" && values.scope === "grade")) && typeof grade === "string") {
    const numericGrade = Number(grade);
    if (!Number.isInteger(numericGrade) || numericGrade < 1 || numericGrade > 12) return "年级必须是 1–12 的整数";
  }
  return null;
}

export function initialValues(kind: ResourceKind, record?: ResourceRow): Record<string, FormValue> {
  return Object.fromEntries(editableFields(kind, Boolean(record)).map((field) => {
    const value = record?.[field.recordKey ?? field.name];
    if (field.type === "checkbox") return [field.name, value === undefined ? true : Boolean(value)];
    if (field.type === "select" && !value) return [field.name, field.lookup ? "" : field.options?.[0]?.value ?? ""];
    if (field.type === "color" && !value) return [field.name, "#c56473"];
    return [field.name, typeof value === "string" || typeof value === "number" ? String(value) : ""];
  }));
}

export function buildResourceBody(kind: ResourceKind, values: Record<string, FormValue>, isEdit: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of relevantFields(kind, values, isEdit)) {
    const value = values[field.name];
    if (kind === "teachers" && field.name === "password" && isEdit && value === "") continue;
    if (typeof value === "boolean") body[field.name] = value;
    if (typeof value === "string" && value !== "") body[field.name] = field.type === "number" ? Number(value) : value.trim();
  }
  return body;
}

export function ResourceForm({ kind, record, open, lookups, onClose }: {
  kind: ResourceKind;
  record?: ResourceRow;
  open: boolean;
  lookups: Lookups;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const config = RESOURCE_CONFIGS[kind];
  const [values, setValues] = useState<Record<string, FormValue>>(() => initialValues(kind, record));
  const [validation, setValidation] = useState("");
  useEffect(() => { if (open) { setValues(initialValues(kind, record)); setValidation(""); } }, [kind, open, record]);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiFetch<ResourceRow>(record ? `${config.endpoint}/${encodeURIComponent(record.id)}` : config.endpoint, { method: record ? "PATCH" : "POST", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", kind] });
      if (kind !== "channels") void queryClient.invalidateQueries({ queryKey: ["channels"] });
      onClose();
    },
  });

  function update(name: string, value: FormValue) { setValues((current) => ({ ...current, [name]: value })); }
  function optionsFor(field: FieldDefinition) {
    if (!field.lookup) return field.options ?? [];
    return lookups[field.lookup].map((item) => ({ value: item.id, label: "display_name" in item && typeof item.display_name === "string" ? item.display_name : String(item.name) }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const error = validateResource(kind, values, Boolean(record));
    if (error) { setValidation(error); return; }
    setValidation("");
    mutation.mutate(buildResourceBody(kind, values, Boolean(record)));
  }

  const fields = relevantFields(kind, values, Boolean(record));
  return <Dialog open={open} title={`${record ? "编辑" : "新增"}${config.singular}`} description={record ? "修改将提交到服务端并刷新当前资源列表。" : `填写以下信息创建${config.singular}。`} onClose={mutation.isPending ? undefined : onClose} className="max-w-2xl">
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">{fields.map((field) => field.type === "checkbox" ? (
        <label key={field.name} className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-md border border-border px-3.5 text-copy-14 font-medium text-neutral-8"><input type="checkbox" className="h-4 w-4 accent-accent" checked={Boolean(values[field.name])} onChange={(event) => update(field.name, event.target.checked)} />{field.label}</label>
      ) : (
        <div key={field.name} className={field.type === "password" || field.name === "name" ? "space-y-2 sm:col-span-2" : "space-y-2"}><Label htmlFor={`resource-${field.name}`}>{field.label}{(field.required || (field.requiredOnCreate && !record)) && <span className="ml-1 text-error" aria-hidden="true">*</span>}</Label>{field.type === "select" ? <Select id={`resource-${field.name}`} value={String(values[field.name] ?? "")} onChange={(event) => update(field.name, event.target.value)} required={field.required}><option value="">请选择</option>{optionsFor(field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select> : <Input id={`resource-${field.name}`} type={field.type} value={String(values[field.name] ?? "")} onChange={(event) => update(field.name, event.target.value)} required={field.required || (field.requiredOnCreate && !record)} min={field.type === "number" ? 1 : undefined} max={field.type === "number" ? 12 : undefined} step={field.type === "number" ? 1 : undefined} maxLength={field.type === "number" ? undefined : field.type === "password" ? 72 : 120} autoComplete={field.type === "password" ? "new-password" : "off"} />}{field.helper && <p className="text-label-12 leading-5 text-neutral-7">{field.helper}</p>}</div>
      ))}</div>
      {(validation || mutation.error) && <InlineError error={validation || mutation.error} />}
      <div className="flex justify-end gap-3 border-t border-border pt-5"><Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>取消</Button><Button type="submit" isLoading={mutation.isPending}>{record ? "保存修改" : `创建${config.singular}`}</Button></div>
    </form>
  </Dialog>;
}
