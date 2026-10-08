import { useState } from "react"
import { CircleNotchIcon, PlusIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/**
 * Coaching workspaces add batches here after onboarding — the server's
 * POST /classes/batch mirrors the wizard: classes row with the batch label,
 * synthesized B## section, subjects matched/created by name, and the
 * owner's teacher_assignments so the batch shows up everywhere.
 */
export function AddBatchDrawer({
  open,
  onOpenChange,
  availableSubjects,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing subject names to offer as one-tap chips. */
  availableSubjects: string[]
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [grade, setGrade] = useState<string>("")
  const [subjects, setSubjects] = useState<string[]>([])
  const [customSubject, setCustomSubject] = useState("")
  const [saving, setSaving] = useState(false)

  const toggleSubject = (s: string) =>
    setSubjects((cur) =>
      cur.some((x) => x.toLowerCase() === s.toLowerCase())
        ? cur.filter((x) => x.toLowerCase() !== s.toLowerCase())
        : [...cur, s]
    )
  const addCustom = () => {
    const t = customSubject.trim()
    if (!t) return
    if (!subjects.some((s) => s.toLowerCase() === t.toLowerCase())) {
      setSubjects((c) => [...c, t])
    }
    setCustomSubject("")
  }

  const reset = () => {
    setName("")
    setGrade("")
    setSubjects([])
    setCustomSubject("")
  }

  const canSave = name.trim() !== "" && subjects.length > 0 && !saving

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await apiClient.post("/api/classes/batch", {
        name: name.trim(),
        grade: grade === "" ? 0 : Number(grade),
        subjects,
      })
      toast.success(`Batch "${name.trim()}" created`)
      reset()
      onOpenChange(false)
      onCreated()
    } catch (err) {
      showError(err, "Couldn't create the batch")
    } finally {
      setSaving(false)
    }
  }

  // Chips: curated existing subjects first, then any custom ones the user
  // typed that aren't in the list yet.
  const extraChips = subjects.filter(
    (s) => !availableSubjects.some((a) => a.toLowerCase() === s.toLowerCase())
  )

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o) }}>
      <SheetContent className="flex w-full flex-col gap-0 data-[side=right]:w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add a batch</SheetTitle>
          <SheetDescription>
            Name it the way you say it out loud — "Weekend JEE 10th",
            "Morning Foundation". Pick every subject you teach in it.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input
              id="batch-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend JEE 10th"
            />
          </div>

          <div className="grid gap-1.5">
            <Label>
              Grade{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Mixed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Mixed</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Subjects</Label>
            <div className="flex flex-wrap gap-2">
              {availableSubjects.map((s) => {
                const active = subjects.some(
                  (x) => x.toLowerCase() === s.toLowerCase()
                )
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSubject(s)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {s}
                  </button>
                )
              })}
              {extraChips.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSubject(s)}
                  className="rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add another subject"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addCustom()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustom}
                disabled={!customSubject.trim()}
              >
                Add
              </Button>
            </div>
            {subjects.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Pick at least one subject to continue.
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!canSave}>
            {saving ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <PlusIcon className="size-4" />
                Create batch
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
