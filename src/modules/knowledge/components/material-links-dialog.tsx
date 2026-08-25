import { useEffect, useMemo, useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
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
 * Lets a teacher change which of her other class-subjects a material is linked
 * to. The primary class-subject (the one it was uploaded under) is always
 * linked and shown as read-only; teachers only toggle the "extras".
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

  useEffect(() => {
    if (material) {
      setSelected(
        material.linked_class_subject_ids.filter(
          (id) => id !== material.class_subject_id,
        ),
      )
    }
  }, [material])

  const lockedIds = useMemo(
    () => new Set(material ? [material.class_subject_id] : []),
    [material],
  )

  const extraOptions = useMemo(
    () => (material ? options.filter((o) => o.class_subject_id !== material.class_subject_id) : []),
    [material, options],
  )

  const handleSave = async () => {
    if (!material) return
    setSaving(true)
    try {
      const desiredIds = [material.class_subject_id, ...selected]
      const res = await apiClient.patch<{ linked_class_subject_ids: string[] }>(
        `/api/knowledge/material/${material.id}/links`,
        { class_subject_ids: desiredIds },
      )
      onSaved(material.id, res.linked_class_subject_ids ?? desiredIds)
      toast.success("Links updated")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update links")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this material</DialogTitle>
          <DialogDescription>
            Pick the other class-subjects where this material should appear.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4">
          {material && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Uploaded under
              </p>
              <div className="inline-flex w-fit items-center rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium">
                {primaryLabel(material.class_subject_id)}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Also add to
            </p>
            <ClassSubjectMultiSelect
              options={extraOptions}
              value={selected}
              onChange={setSelected}
              disabledIds={lockedIds}
              emptyLabel="You only teach one class-subject — nothing else to share to."
            />
          </div>
        </div>

        <Separator />

        <DialogFooter className="gap-2 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2Icon className="size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
