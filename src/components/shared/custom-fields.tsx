import { useEffect, useState } from "react"

import { apiClient } from "@/lib/api-client"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * School-defined custom form fields (managed on /setup, migration 026).
 * `CustomFieldsInputs` renders them inside the Add/Edit student & teacher
 * drawers; `CustomFieldsDisplay` shows saved values on detail views. System
 * fields never appear here — they are the forms' own hardcoded inputs.
 */

export interface CustomFieldDef {
  id: string
  field_key: string
  label: string
  field_type: "text" | "number" | "date" | "select" | "phone" | "email" | "boolean"
  options: string[] | null
  required: boolean
  section?: string | null
  placeholder?: string | null
  sort_order: number
}

export type CustomFieldValues = Record<string, string | number | boolean>

// Session-level cache: the defs change only when an admin edits /setup.
const defsCache = new Map<string, CustomFieldDef[]>()

export function useCustomFieldDefs(entity: "student" | "teacher") {
  const [defs, setDefs] = useState<CustomFieldDef[]>(
    () => defsCache.get(entity) ?? []
  )

  useEffect(() => {
    let alive = true
    apiClient
      .get<{ custom_fields: CustomFieldDef[] }>(
        `/api/custom-fields?entity=${entity}`
      )
      .then((res) => {
        const fields = res.custom_fields ?? []
        defsCache.set(entity, fields)
        if (alive) setDefs(fields)
      })
      .catch(() => {
        if (alive && !defsCache.has(entity)) setDefs([])
      })
    return () => {
      alive = false
    }
  }, [entity])

  return defs
}

/** Fields belonging to one form section ('additional' when unset). */
export function defsForSection(defs: CustomFieldDef[], section: string) {
  return defs
    .filter((d) => (d.section ?? "additional") === section)
    .sort((a, b) => a.sort_order - b.sort_order)
}

/** Returns the labels of required fields that are still empty, for a
 *  pre-submit check in the drawers. */
export function missingRequiredCustomFields(
  defs: CustomFieldDef[],
  values: CustomFieldValues
): string[] {
  return defs
    .filter((d) => d.required && d.field_type !== "boolean")
    .filter((d) => {
      const v = values[d.field_key]
      return v === undefined || v === null || String(v).trim() === ""
    })
    .map((d) => d.label)
}

const inputTypeFor: Record<string, string> = {
  text: "text",
  number: "number",
  date: "date",
  phone: "tel",
  email: "email",
}

export function CustomFieldsInputs({
  defs,
  values,
  onChange,
}: {
  defs: CustomFieldDef[]
  values: CustomFieldValues
  onChange: (next: CustomFieldValues) => void
}) {
  if (defs.length === 0) return null

  const set = (key: string, value: string | number | boolean) =>
    onChange({ ...values, [key]: value })

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {defs.map((def) => (
        <div key={def.id} className="flex flex-col gap-1.5">
          <Label className="text-xs">
            {def.label}
            {def.required && <span className="text-destructive"> *</span>}
          </Label>
          {def.field_type === "boolean" ? (
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm text-secondary-foreground">
              <Checkbox
                checked={values[def.field_key] === true}
                onCheckedChange={(v) => set(def.field_key, Boolean(v))}
              />
              {def.placeholder || "Yes"}
            </label>
          ) : def.field_type === "select" ? (
            <Select
              value={values[def.field_key] != null ? String(values[def.field_key]) : ""}
              onValueChange={(v) => set(def.field_key, v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={def.placeholder || "Select…"} />
              </SelectTrigger>
              <SelectContent>
                {(def.options ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={inputTypeFor[def.field_type] ?? "text"}
              placeholder={def.placeholder ?? undefined}
              value={values[def.field_key] != null ? String(values[def.field_key]) : ""}
              onChange={(e) =>
                set(
                  def.field_key,
                  def.field_type === "number" && e.target.value !== ""
                    ? Number(e.target.value)
                    : e.target.value
                )
              }
              maxLength={500}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/** Read-only label/value pairs for detail drawers. Renders nothing when the
 *  school has no custom fields or the record has no values. */
export function CustomFieldsDisplay({
  entity,
  values,
}: {
  entity: "student" | "teacher"
  values: CustomFieldValues | null | undefined
}) {
  const defs = useCustomFieldDefs(entity)
  const rows = defs
    .map((d) => {
      const raw = values?.[d.field_key]
      const value =
        d.field_type === "boolean" && typeof raw === "boolean"
          ? raw
            ? "Yes"
            : "No"
          : raw
      return { label: d.label, value }
    })
    .filter((r) => r.value !== undefined && r.value !== null && String(r.value).trim() !== "")

  if (rows.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map((r) => (
        <div key={r.label} className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {r.label}
          </span>
          <span className="truncate text-sm text-foreground">{String(r.value)}</span>
        </div>
      ))}
    </div>
  )
}
