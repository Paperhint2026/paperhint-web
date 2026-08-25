import { useState } from "react"
import { PlusIcon, TrashIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export interface ElectiveGroup {
  groupName: string
  subjectIds: string[]
}

interface ElectiveConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectionName: string
  availableSubjects: { value: string; label: string }[]
  coreSubjectIds: string[]
  initialGroups: ElectiveGroup[]
  otherSectionsElectives?: ElectiveGroup[][]
  onSave: (groups: ElectiveGroup[]) => void
}

export function ElectiveConfigModal({
  open,
  onOpenChange,
  sectionName,
  availableSubjects,
  coreSubjectIds,
  initialGroups,
  onSave,
}: ElectiveConfigModalProps) {
  const [groups, setGroups] = useState<ElectiveGroup[]>(() =>
    initialGroups.length > 0
      ? initialGroups.map((g) => ({ ...g, subjectIds: [...g.subjectIds] }))
      : [{ groupName: "", subjectIds: [] }],
  )

  const addGroup = () => {
    setGroups((prev) => [...prev, { groupName: "", subjectIds: [] }])
  }

  const removeGroup = (index: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== index))
  }

  const updateGroupName = (index: number, name: string) => {
    setGroups((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], groupName: name }
      return updated
    })
  }

  const toggleSubjectInGroup = (groupIndex: number, subjectId: string) => {
    setGroups((prev) => {
      const updated = [...prev]
      const group = updated[groupIndex]
      const exists = group.subjectIds.includes(subjectId)
      updated[groupIndex] = {
        ...group,
        subjectIds: exists
          ? group.subjectIds.filter((id) => id !== subjectId)
          : [...group.subjectIds, subjectId],
      }
      return updated
    })
  }

  const isSubjectDisabledForGroup = (
    groupIndex: number,
    subjectId: string,
  ): boolean => {
    if (coreSubjectIds.includes(subjectId)) return true
    for (let i = 0; i < groups.length; i++) {
      if (i === groupIndex) continue
      if (groups[i].subjectIds.includes(subjectId)) return true
    }
    return false
  }

  const isValid =
    groups.length === 0 ||
    groups.every(
      (g) => g.groupName.trim() !== "" && g.subjectIds.length >= 2,
    )

  const handleSave = () => {
    const filtered = groups.filter(
      (g) => g.groupName.trim() !== "" && g.subjectIds.length >= 2,
    )
    onSave(filtered)
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] flex-col sm:max-w-2xl"
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>
                Elective Subjects — Section {sectionName}
              </DialogTitle>
              <DialogDescription>
                Configure elective groups. Each group needs a name and at least 2
                subject options. Students will pick one subject from each group.
              </DialogDescription>
            </div>
            <button
              className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={handleClose}
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-2">
          <div className="flex flex-col gap-4">
            {groups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Group Name
                    </Label>
                    <Input
                      placeholder='e.g. "Second Language", "Skill Subject"'
                      value={group.groupName}
                      onChange={(e) =>
                        updateGroupName(groupIndex, e.target.value)
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="mt-5 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeGroup(groupIndex)}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Subject Options{" "}
                    <span className="text-muted-foreground/60">
                      (select at least 2)
                    </span>
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSubjects.map((subject) => {
                      const selected = group.subjectIds.includes(subject.value)
                      const disabled = isSubjectDisabledForGroup(
                        groupIndex,
                        subject.value,
                      )
                      return (
                        <button
                          key={subject.value}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            toggleSubjectInGroup(groupIndex, subject.value)
                          }
                          className={
                            disabled
                              ? "inline-flex items-center rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground/40 line-through"
                              : selected
                                ? "inline-flex items-center rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors"
                                : "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                          }
                        >
                          {subject.label}
                        </button>
                      )
                    })}
                  </div>
                  {group.subjectIds.length > 0 &&
                    group.subjectIds.length < 2 && (
                      <p className="text-xs text-amber-600">
                        Need at least 2 subjects in an elective group
                      </p>
                    )}
                </div>
              </div>
            ))}

            <div>
              <Button variant="secondary" size="sm" onClick={addGroup}>
                <PlusIcon className="size-4" />
                Add Elective Group
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={!isValid} onClick={handleSave}>
            Save Electives
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
