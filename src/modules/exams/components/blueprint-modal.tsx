import { useEffect, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import {
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface BlueprintSection {
  section: string
  type: string
  num_questions: number
  marks_per_question: number
}

export interface Blueprint {
  id: string
  teacher_id: string
  name: string
  sections: BlueprintSection[]
  total_marks: number
  created_at: string
}

interface BlueprintModalProps {
  open: boolean
  onClose: () => void
  onSaved: (bp: Blueprint) => void
  initial?: BlueprintSection[]
}

const EMPTY_SECTION: BlueprintSection = {
  section: "",
  type: "",
  num_questions: 1,
  marks_per_question: 1,
}

export function BlueprintModal({ open, onClose, onSaved, initial }: BlueprintModalProps) {
  const [name, setName] = useState("")
  const [sections, setSections] = useState<BlueprintSection[]>([
    { ...EMPTY_SECTION, section: "A" },
  ])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setSections(
        initial && initial.length > 0
          ? initial.map((s) => ({ ...s }))
          : [{ ...EMPTY_SECTION, section: "A" }],
      )
    }
  }, [open, initial])

  const totalMarks = sections.reduce(
    (sum, s) => sum + s.num_questions * s.marks_per_question,
    0,
  )

  const update = (idx: number, field: keyof BlueprintSection, value: string | number) => {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    )
  }

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      { ...EMPTY_SECTION, section: String.fromCharCode(65 + prev.length) },
    ])
  }

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Blueprint name is required")
    if (sections.length === 0) return toast.error("Add at least one section")

    setIsSaving(true)
    try {
      const res = await apiClient.post<{ blueprint: Blueprint }>("/api/blueprints", {
        name: name.trim(),
        sections,
      })
      toast.success("Blueprint saved")
      onSaved(res.blueprint)
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to save blueprint")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-[100] flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Create Blueprint</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Create a new exam blueprint with sections</DialogPrimitive.Description>

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold sm:text-base">Create Blueprint</h2>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {/* Name */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium">Blueprint Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Class 10 Science — Mid Term"
                className="text-sm"
              />
            </div>

            {/* Section table */}
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-medium">Sections</label>
              <button
                onClick={addSection}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <PlusIcon className="size-3" />
                Add Section
              </button>
            </div>

            {/* Table header — desktop */}
            <div className="mb-1.5 hidden grid-cols-[1fr_1.5fr_1fr_1fr_0.8fr_28px] gap-2 px-1 sm:grid">
              {["Section", "Type", "Qty", "Marks", "Total", ""].map((h) => (
                <span key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {h}
                </span>
              ))}
            </div>

            <div className="space-y-2">
              {sections.map((sec, idx) => {
                const rowTotal = sec.num_questions * sec.marks_per_question
                return (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-lg border bg-muted/20 p-2.5",
                      "grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.5fr_1fr_1fr_0.8fr_28px] sm:items-center sm:rounded-md sm:border-0 sm:bg-transparent sm:p-0",
                    )}
                  >
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground sm:hidden">
                        Section
                      </label>
                      <Input
                        value={sec.section}
                        onChange={(e) => update(idx, "section", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground sm:hidden">
                        Type
                      </label>
                      <Input
                        value={sec.type}
                        onChange={(e) => update(idx, "type", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="e.g., MCQ"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground sm:hidden">
                        Questions
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={sec.num_questions}
                        onChange={(e) => update(idx, "num_questions", Number(e.target.value))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground sm:hidden">
                        Marks each
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={sec.marks_per_question}
                        onChange={(e) => update(idx, "marks_per_question", Number(e.target.value))}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center">
                      <span className="text-[10px] font-medium text-muted-foreground sm:hidden">Total:&nbsp;</span>
                      <span className="text-xs font-semibold">{rowTotal}</span>
                    </div>
                    <div className="flex items-center justify-end">
                      {sections.length > 1 && (
                        <button
                          onClick={() => removeSection(idx)}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Total */}
            <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/5 px-4 py-2.5">
              <span className="text-sm font-medium">Total Marks</span>
              <span className="text-lg font-bold text-primary">{totalMarks}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 gap-3 border-t bg-muted/30 px-4 py-3 sm:px-5">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
              Save Blueprint
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
