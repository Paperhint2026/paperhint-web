import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarBlankIcon,
  CheckSquareIcon,
  CaretUpDownIcon,
  CircleNotchIcon,
  EnvelopeIcon,
  HashIcon,
  LockSimpleIcon,
  PhoneIcon,
  TextAaIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { showError } from "@/lib/show-error"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─────────────────────────────────────────────────────────────────────────────
// Form builder — three panes like a real form designer, shaped to our forms:
//   left   a palette of field types (click or drag onto a section)
//   middle the form as it renders: its sections, built-ins locked in place,
//          custom fields selectable / draggable / removable
//   right  properties of the selected (or new) field
//
// STAGED EDITS: nothing is written while designing. Add / edit / drag /
// delete all mutate a local draft; the bottom bar's Save commits the whole
// diff (creates, updates, deletes) in one go, Discard resets to the last
// saved state. The real Add-Student/Teacher forms only ever see saved state.
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: typeof TextAaIcon }> = {
  text: { label: "Text", icon: TextAaIcon },
  number: { label: "Number", icon: HashIcon },
  date: { label: "Date", icon: CalendarBlankIcon },
  select: { label: "Dropdown", icon: CaretUpDownIcon },
  phone: { label: "Phone", icon: PhoneIcon },
  email: { label: "Email", icon: EnvelopeIcon },
  boolean: { label: "Yes / No", icon: CheckSquareIcon },
}

interface SectionDef {
  key: string
  title: string
}

interface SystemField {
  key: string
  label: string
  field_type: string
  required: boolean
  section: string
}

interface CustomField {
  id: string // temp-* until saved
  field_key: string
  label: string
  field_type: string
  options: string[] | null
  required: boolean
  section: string
  placeholder: string | null
  sort_order: number
}

type Selection =
  | { mode: "edit"; fieldId: string }
  | { mode: "new"; fieldType: string; section?: string }
  | null

type DragItem =
  | { kind: "palette"; fieldType: string }
  | { kind: "field"; id: string }

const isTemp = (id: string) => id.startsWith("temp-")

export function FormBuilder({ entity }: { entity: "student" | "teacher" }) {
  const [sections, setSections] = useState<SectionDef[]>([])
  const [systemFields, setSystemFields] = useState<SystemField[]>([])
  const [original, setOriginal] = useState<CustomField[] | null>(null)
  const [draft, setDraft] = useState<CustomField[]>([])
  const [selection, setSelection] = useState<Selection>(null)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        sections: SectionDef[]
        system_fields: SystemField[]
        custom_fields: CustomField[]
      }>(`/api/custom-fields?entity=${entity}`)
      setSections(res.sections ?? [])
      setSystemFields(res.system_fields ?? [])
      setOriginal(res.custom_fields ?? [])
      setDraft(res.custom_fields ?? [])
    } catch (err) {
      showError(err)
      setOriginal([])
      setDraft([])
    }
  }, [entity])

  useEffect(() => {
    load()
    setSelection(null)
  }, [load])

  const draftBySection = useMemo(() => {
    const map = new Map<string, CustomField[]>()
    for (const f of draft) {
      const key = f.section || "additional"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order)
    }
    return map
  }, [draft])

  const changedAgainst = useCallback(
    (o: CustomField, f: CustomField) =>
      o.label !== f.label ||
      (o.placeholder ?? null) !== (f.placeholder ?? null) ||
      o.required !== f.required ||
      (o.section || "additional") !== (f.section || "additional") ||
      o.sort_order !== f.sort_order ||
      JSON.stringify(o.options) !== JSON.stringify(f.options),
    []
  )

  const dirty = useMemo(() => {
    if (original === null) return false
    if (original.length !== draft.length) return true
    const byId = new Map(original.map((f) => [f.id, f]))
    return draft.some((f) => {
      const o = byId.get(f.id)
      return !o || changedAgainst(o, f)
    })
  }, [original, draft, changedAgainst])

  const selectedField =
    selection?.mode === "edit"
      ? (draft.find((f) => f.id === selection.fieldId) ?? null)
      : null

  // ── staged mutations (local only) ────────────────────────────────────────
  const stageAdd = (values: {
    fieldType: string
    label: string
    placeholder: string
    section: string
    required: boolean
    options?: string[]
  }) => {
    const sectionList = draftBySection.get(values.section) ?? []
    const field: CustomField = {
      id: `temp-${crypto.randomUUID()}`,
      field_key: "",
      label: values.label,
      field_type: values.fieldType,
      options: values.options ?? null,
      required: values.required,
      section: values.section,
      placeholder: values.placeholder || null,
      sort_order: sectionList.length,
    }
    setDraft((prev) => [...prev, field])
    setSelection({ mode: "edit", fieldId: field.id })
  }

  const stageEdit = (
    fieldId: string,
    values: {
      label: string
      placeholder: string
      section: string
      required: boolean
      options?: string[]
    }
  ) => {
    setDraft((prev) => {
      const current = prev.find((f) => f.id === fieldId)
      if (!current) return prev
      const sectionChanged =
        (current.section || "additional") !== values.section
      return prev.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              label: values.label,
              placeholder: values.placeholder || null,
              section: values.section,
              required: values.required,
              options: values.options ?? f.options,
              sort_order: sectionChanged
                ? prev.filter(
                    (x) =>
                      (x.section || "additional") === values.section &&
                      x.id !== fieldId
                  ).length
                : f.sort_order,
            }
          : f
      )
    })
  }

  const stageRemove = (fieldId: string) => {
    setDraft((prev) => prev.filter((f) => f.id !== fieldId))
    setSelection((cur) =>
      cur?.mode === "edit" && cur.fieldId === fieldId ? null : cur
    )
  }

  /** Place fieldId into targetSection before beforeId (null = append),
   *  renumbering the target section — all in the local draft. */
  const placeField = (
    fieldId: string,
    targetSection: string,
    beforeId: string | null
  ) => {
    setDraft((prev) => {
      const moving = prev.find((f) => f.id === fieldId)
      if (!moving) return prev
      const target = prev
        .filter(
          (f) =>
            (f.section || "additional") === targetSection && f.id !== fieldId
        )
        .sort((a, b) => a.sort_order - b.sort_order)
      const insertAt = beforeId
        ? Math.max(
            0,
            target.findIndex((f) => f.id === beforeId)
          )
        : target.length
      target.splice(insertAt, 0, { ...moving, section: targetSection })
      const orderById = new Map(target.map((f, i) => [f.id, i]))
      return prev.map((f) => {
        if (f.id === fieldId) {
          return {
            ...f,
            section: targetSection,
            sort_order: orderById.get(f.id) ?? 0,
          }
        }
        if (orderById.has(f.id)) {
          return { ...f, sort_order: orderById.get(f.id)! }
        }
        return f
      })
    })
  }

  const move = (field: CustomField, dir: -1 | 1) => {
    const list = draftBySection.get(field.section || "additional") ?? []
    const idx = list.findIndex((f) => f.id === field.id)
    const other = list[idx + dir]
    if (!other) return
    const beforeId = dir === -1 ? other.id : (list[idx + 2]?.id ?? null)
    placeField(field.id, field.section || "additional", beforeId)
  }

  // ── drag & drop (stages locally, like everything else) ───────────────────
  const [drag, setDrag] = useState<DragItem | null>(null)
  const [dropHint, setDropHint] = useState<{
    section: string
    beforeId: string | null
  } | null>(null)

  const clearDrag = () => {
    setDrag(null)
    setDropHint(null)
  }

  const handleDrop = (targetSection: string, beforeId: string | null) => {
    if (!drag) return
    if (drag.kind === "palette") {
      setSelection({
        mode: "new",
        fieldType: drag.fieldType,
        section: targetSection,
      })
    } else {
      placeField(drag.id, targetSection, beforeId)
    }
    clearDrag()
  }

  // ── save / discard — the only writes ─────────────────────────────────────
  const save = async () => {
    if (original === null) return
    setIsSaving(true)
    try {
      const draftIds = new Set(draft.map((f) => f.id))
      const originalById = new Map(original.map((f) => [f.id, f]))

      const deletions = original.filter((f) => !draftIds.has(f.id))
      const additions = draft.filter((f) => isTemp(f.id))
      const updates = draft.filter((f) => {
        if (isTemp(f.id)) return false
        const o = originalById.get(f.id)
        return o ? changedAgainst(o, f) : false
      })

      await Promise.all(
        deletions.map((f) => apiClient.delete(`/api/custom-fields/${f.id}`))
      )
      await Promise.all(
        updates.map((f) =>
          apiClient.put(`/api/custom-fields/${f.id}`, {
            label: f.label,
            placeholder: f.placeholder,
            section: f.section || "additional",
            required: f.required,
            options: f.field_type === "select" ? (f.options ?? []) : undefined,
            sort_order: f.sort_order,
          })
        )
      )
      // additions sequentially so unique-key suffixing can't race itself
      for (const f of additions) {
        await apiClient.post("/api/custom-fields", {
          entity,
          label: f.label,
          field_type: f.field_type,
          options: f.options ?? undefined,
          required: f.required,
          section: f.section || "additional",
          placeholder: f.placeholder,
          sort_order: f.sort_order,
        })
      }

      toast.success("Form saved")
      setSelection(null)
      await load()
    } catch (err) {
      showError(err)
    } finally {
      setIsSaving(false)
    }
  }

  const discard = () => {
    setDraft(original ?? [])
    setSelection(null)
  }

  if (original === null) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Palette */}
        <div className="flex shrink-0 flex-col gap-2 lg:w-40">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            New field
          </p>
          <div className="grid grid-cols-3 gap-1.5 max-lg:grid-cols-6 max-sm:grid-cols-3 lg:grid-cols-2">
            {Object.entries(TYPE_META).map(([type, meta]) => (
              <button
                key={type}
                type="button"
                draggable
                onDragStart={(e) => {
                  setDrag({ kind: "palette", fieldType: type })
                  e.dataTransfer.effectAllowed = "copy"
                }}
                onDragEnd={clearDrag}
                onClick={() => setSelection({ mode: "new", fieldType: type })}
                className={cn(
                  "flex cursor-grab flex-col items-center gap-1 rounded-lg border border-border bg-background px-2 py-2.5 text-[11px] text-secondary-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:cursor-grabbing",
                  selection?.mode === "new" &&
                    selection.fieldType === type &&
                    "border-primary/40 bg-primary/10 text-primary"
                )}
              >
                <meta.icon className="size-4" />
                {meta.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Click a type — or drag it onto a section. Nothing changes on the
            real form until you save below.
          </p>
        </div>

        {/* Live form preview */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-background">
          <div className="flex flex-col gap-6 p-5">
            {sections.map((section) => {
              const sysHere = systemFields.filter(
                (f) => f.section === section.key
              )
              const customHere = draftBySection.get(section.key) ?? []
              if (
                sysHere.length === 0 &&
                customHere.length === 0 &&
                section.key !== "additional"
              ) {
                return null
              }
              const isSectionTarget =
                dropHint?.section === section.key && dropHint.beforeId === null
              return (
                <div
                  key={section.key}
                  className={cn(
                    "flex flex-col gap-3 rounded-lg p-2 transition-colors",
                    drag && "outline-1 outline-border outline-dashed",
                    isSectionTarget && "bg-primary/5 outline-primary/50"
                  )}
                  onDragOver={(e) => {
                    if (!drag) return
                    e.preventDefault()
                    if (e.target === e.currentTarget || isSectionTarget) {
                      setDropHint({ section: section.key, beforeId: null })
                    }
                  }}
                  onDragEnter={(e) => {
                    if (!drag) return
                    e.preventDefault()
                    setDropHint((cur) =>
                      cur?.section === section.key
                        ? cur
                        : { section: section.key, beforeId: null }
                    )
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(
                      section.key,
                      dropHint?.section === section.key
                        ? dropHint.beforeId
                        : null
                    )
                  }}
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {section.title}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sysHere.map((f) => (
                      <FieldPreview
                        key={f.key}
                        label={f.label}
                        fieldType={f.field_type}
                        required={f.required}
                        locked
                      />
                    ))}
                    {customHere.map((f, i) => (
                      <FieldPreview
                        key={f.id}
                        label={f.label}
                        fieldType={f.field_type}
                        required={f.required}
                        placeholder={f.placeholder}
                        isNew={isTemp(f.id)}
                        selected={
                          selection?.mode === "edit" &&
                          selection.fieldId === f.id
                        }
                        dropBefore={
                          dropHint?.section === section.key &&
                          dropHint.beforeId === f.id
                        }
                        onSelect={() =>
                          setSelection({ mode: "edit", fieldId: f.id })
                        }
                        onMoveUp={i > 0 ? () => move(f, -1) : undefined}
                        onMoveDown={
                          i < customHere.length - 1
                            ? () => move(f, 1)
                            : undefined
                        }
                        onDelete={() => stageRemove(f.id)}
                        onDragStart={() => setDrag({ kind: "field", id: f.id })}
                        onDragEnd={clearDrag}
                        onDragOverCard={() => {
                          if (!drag) return
                          if (drag.kind === "field" && drag.id === f.id) return
                          setDropHint({ section: section.key, beforeId: f.id })
                        }}
                        onDropOnCard={() => handleDrop(section.key, f.id)}
                      />
                    ))}
                    {customHere.length === 0 &&
                      section.key === "additional" &&
                      sysHere.length === 0 && (
                        <p className="col-span-full rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                          Drag a type from the palette onto any section — or
                          drop it here for the trailing block.
                        </p>
                      )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Properties */}
        <div className="shrink-0 lg:w-72">
          {selection === null ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium text-secondary-foreground">
                Field properties
              </p>
              <p className="text-xs text-muted-foreground">
                Select a field on the form, or pick a type from the palette to
                add a new one. Locked fields are part of PaperHint's flow.
              </p>
            </div>
          ) : (
            <PropertiesPanel
              key={
                selection.mode === "edit"
                  ? selection.fieldId
                  : `new-${selection.fieldType}-${selection.section ?? "additional"}`
              }
              sections={sections}
              selection={selection}
              field={selectedField}
              onClose={() => setSelection(null)}
              onAdd={stageAdd}
              onEdit={stageEdit}
              onDelete={
                selection.mode === "edit"
                  ? () => stageRemove(selection.fieldId)
                  : undefined
              }
            />
          )}
        </div>
      </div>

      {/* Save bar — the only thing that writes */}
      {dirty && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-sm">
          <p className="text-xs text-muted-foreground">
            Unsaved changes — the real form updates when you save.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={discard}
              disabled={isSaving}
            >
              Discard
            </Button>
            <Button size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? (
                <>
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── One field as the form will render it ─────────────────────────────────────

function FieldPreview({
  label,
  fieldType,
  required,
  placeholder,
  locked = false,
  selected = false,
  dropBefore = false,
  isNew = false,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
}: {
  label: string
  fieldType: string
  required: boolean
  placeholder?: string | null
  locked?: boolean
  selected?: boolean
  dropBefore?: boolean
  isNew?: boolean
  onSelect?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDelete?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  onDragOverCard?: () => void
  onDropOnCard?: () => void
}) {
  const shell = (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium">
        {locked && (
          <LockSimpleIcon className="size-3 text-muted-foreground/60" />
        )}
        <span className={locked ? "text-muted-foreground" : "text-foreground"}>
          {label}
        </span>
        {required && <span className="text-destructive">*</span>}
        {isNew && (
          <span className="rounded-full bg-primary/10 px-1.5 text-[9px] font-medium text-primary">
            new
          </span>
        )}
        <span className="ml-auto text-[10px] font-normal text-muted-foreground/70">
          {TYPE_META[fieldType]?.label ?? fieldType}
        </span>
      </span>
      {fieldType === "boolean" ? (
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground/60">
          <span className="size-4 rounded-[4px] border border-border bg-background" />
          {placeholder || "Yes"}
        </div>
      ) : fieldType === "select" ? (
        <div className="flex h-9 items-center justify-between rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground/60">
          {placeholder || "Select…"}
          <CaretUpDownIcon className="size-3.5" />
        </div>
      ) : (
        <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground/60">
          {placeholder || (fieldType === "date" ? "Pick a date" : "")}
        </div>
      )}
    </div>
  )

  if (locked) {
    return <div className="rounded-lg p-2 opacity-80">{shell}</div>
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        onDragStart?.()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!onDragOverCard) return
        e.preventDefault()
        e.stopPropagation()
        onDragOverCard()
      }}
      onDrop={(e) => {
        if (!onDropOnCard) return
        e.preventDefault()
        e.stopPropagation()
        onDropOnCard()
      }}
      className={cn(
        "group relative cursor-grab rounded-lg p-2 ring-1 transition-all active:cursor-grabbing",
        selected
          ? "bg-primary/5 ring-primary/40"
          : "ring-transparent hover:bg-muted/40 hover:ring-border",
        dropBefore &&
          "before:absolute before:-top-2 before:right-1 before:left-1 before:h-0.5 before:rounded-full before:bg-primary"
      )}
    >
      {shell}
      <span
        className={cn(
          "absolute -top-2.5 right-2 flex gap-0.5 rounded-full border border-border bg-background px-1 py-0.5 opacity-0 shadow-sm transition-opacity",
          "group-hover:opacity-100",
          selected && "opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {onMoveUp && (
          <button
            type="button"
            onClick={onMoveUp}
            className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Move up"
          >
            <ArrowUpIcon className="size-3" />
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            onClick={onMoveDown}
            className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Move down"
          >
            <ArrowDownIcon className="size-3" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
            aria-label="Remove"
          >
            <TrashIcon className="size-3" />
          </button>
        )}
      </span>
    </div>
  )
}

// ── Properties panel — stages into the draft, never calls the API ───────────

function PropertiesPanel({
  sections,
  selection,
  field,
  onClose,
  onAdd,
  onEdit,
  onDelete,
}: {
  sections: SectionDef[]
  selection: NonNullable<Selection>
  field: CustomField | null
  onClose: () => void
  onAdd: (values: {
    fieldType: string
    label: string
    placeholder: string
    section: string
    required: boolean
    options?: string[]
  }) => void
  onEdit: (
    fieldId: string,
    values: {
      label: string
      placeholder: string
      section: string
      required: boolean
      options?: string[]
    }
  ) => void
  onDelete?: () => void
}) {
  const isEdit = selection.mode === "edit"
  const fieldType =
    field?.field_type ??
    (selection.mode === "new" ? selection.fieldType : "text")

  const [label, setLabel] = useState(field?.label ?? "")
  const [placeholder, setPlaceholder] = useState(field?.placeholder ?? "")
  const [section, setSection] = useState(
    field?.section ??
      (selection.mode === "new" ? selection.section : undefined) ??
      "additional"
  )
  const [required, setRequired] = useState(field?.required ?? false)
  const [optionsText, setOptionsText] = useState(
    (field?.options ?? []).join("\n")
  )

  const apply = () => {
    if (!label.trim()) return showError(new Error("Give the field a label"))
    const options =
      fieldType === "select"
        ? optionsText
            .split("\n")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined
    if (fieldType === "select" && (options?.length ?? 0) < 2) {
      return showError(new Error("A dropdown needs at least 2 options"))
    }
    const values = {
      label: label.trim(),
      placeholder: placeholder.trim(),
      section,
      required,
      options,
    }
    if (isEdit && field) {
      onEdit(field.id, values)
    } else {
      onAdd({ ...values, fieldType })
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {isEdit
            ? "Field properties"
            : `New ${TYPE_META[fieldType]?.label.toLowerCase()} field`}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {isEdit
            ? "The type is fixed once created — remove and re-add to change it."
            : "Staged on the preview — the form only changes when you save."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Field label</Label>
        <Input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Transport route"
          maxLength={80}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">
          {fieldType === "boolean" ? "Checkbox caption" : "Placeholder"}
        </Label>
        <Input
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder={
            fieldType === "boolean"
              ? 'e.g. "Yes, student stays in the hostel"'
              : "Shown inside the empty input"
          }
          maxLength={120}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Section</Label>
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {fieldType === "select" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Options — one per line</Label>
          <Textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={4}
            placeholder={"Route A\nRoute B\nRoute C"}
          />
        </div>
      )}

      {fieldType !== "boolean" && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={required}
            onCheckedChange={(v) => setRequired(!!v)}
          />
          Mandatory on the form
        </label>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={apply} className="flex-1">
          {isEdit ? "Apply" : "Add to form"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
        {onDelete && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Remove field"
          >
            <TrashIcon className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
