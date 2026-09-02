import { useEffect, useMemo, useState } from "react"
import { CircleNotchIcon, FileTextIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { tameCaps } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ClassSubjectMultiSelect,
  type ClassSubjectOption,
} from "./class-subject-multi-select"

interface MaterialLinksDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  material: {
    id: string
    title: string
    class_subject_id: string
    linked_class_subject_ids: string[]
  } | null
  options: ClassSubjectOption[]
  primaryLabel: (classSubjectId: string) => string
  onSaved: (materialId: string, linkedIds: string[]) => void
}

/**
 * Lets a teacher change which of her other classes a material is linked to.
 * The class it was uploaded under is always linked and shown locked; only the
 * extras toggle.
 */
export function MaterialLinksDialog({
  open,
  onOpenChange,
  material,
  options,
  primaryLabel,
  onSaved,
}: MaterialLinksDialogProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const initial = useMemo(
    () =>
      material
        ? material.linked_class_subject_ids.filter(
            (id) => id !== material.class_subject_id
          )
        : [],
    [material]
  )

  useEffect(() => {
    setSelected(initial)
  }, [initial])

  const lockedIds = useMemo(
    () => new Set(material ? [material.class_subject_id] : []),
    [material]
  )

  // Uploaded-under first, then the rest, so the locked card leads the grid.
  const orderedOptions = useMemo(() => {
    if (!material) return []
    const primary = options.filter(
      (o) => o.class_subject_id === material.class_subject_id
    )
    const rest = options.filter(
      (o) => o.class_subject_id !== material.class_subject_id
    )
    return [...primary, ...rest]
  }, [material, options])

  const changed =
    selected.length !== initial.length ||
    selected.some((id) => !initial.includes(id))
  const total = 1 + selected.length

  const handleSave = async () => {
    if (!material) return
    setSaving(true)
    try {
      const desiredIds = [material.class_subject_id, ...selected]
      const res = await apiClient.patch<{ linked_class_subject_ids: string[] }>(
        `/api/knowledge/material/${material.id}/links`,
        { class_subject_ids: desiredIds }
      )
      onSaved(material.id, res.linked_class_subject_ids ?? desiredIds)
      toast.success(
        total === 1
          ? "Now only in its own class"
          : `Now visible in ${total} classes`
      )
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update the classes"
      )
    } finally {
      setSaving(false)
    }
  }

  const hasOthers = orderedOptions.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Share to other classes</DialogTitle>
          <DialogDescription>
            This material stays in the class it was uploaded to. Tick any other
            class you teach that should see it as well.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 pb-6">
          {material && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-sidebar px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <FileTextIcon className="size-4 text-muted-foreground" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {tameCaps(material.title)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Uploaded to {primaryLabel(material.class_subject_id)}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-secondary-foreground">
              Classes
            </p>
            <ClassSubjectMultiSelect
              options={orderedOptions}
              value={selected}
              onChange={setSelected}
              disabledIds={lockedIds}
              lockedLabel="Uploaded here"
              placeholder="Add other classes…"
              emptyLabel="You only teach one class, so there's nowhere else to share this."
            />
            {!hasOthers && orderedOptions.length === 1 && (
              <p className="text-xs text-muted-foreground">
                Once you're assigned another class it will appear here.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row items-center border-t border-border bg-sidebar px-6 py-3 sm:justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            Visible in {total} {total === 1 ? "class" : "classes"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !changed}>
              {saving && <CircleNotchIcon className="size-3.5 animate-spin" />}
              Save changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
