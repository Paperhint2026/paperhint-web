import { cn } from "@/lib/utils"

export interface ClassSubjectOption {
  class_subject_id: string
  label: string
  hint?: string
}

interface ClassSubjectMultiSelectProps {
  options: ClassSubjectOption[]
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  disabledIds?: Set<string>
  emptyLabel?: string
}

/**
 * Pill-style multi-select used in two places: the "Also add to…" control in
 * the upload flow, and the per-material link editor. Matches the visual style
 * of the elective-config-modal so teachers have a consistent interaction.
 */
export function ClassSubjectMultiSelect({
  options,
  value,
  onChange,
  disabled,
  disabledIds,
  emptyLabel = "No other classes to link.",
}: ClassSubjectMultiSelectProps) {
  if (options.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  const toggle = (id: string) => {
    if (disabled) return
    if (disabledIds?.has(id)) return
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = value.includes(opt.class_subject_id)
        const isLocked = disabledIds?.has(opt.class_subject_id)
        return (
          <button
            key={opt.class_subject_id}
            type="button"
            disabled={disabled || isLocked}
            onClick={() => toggle(opt.class_subject_id)}
            title={opt.hint}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              isLocked
                ? "border-dashed text-muted-foreground/50"
                : selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              (disabled || isLocked) && "cursor-not-allowed opacity-60",
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
