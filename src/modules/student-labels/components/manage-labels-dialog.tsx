// src/modules/student-labels/components/manage-labels-dialog.tsx
import * as React from "react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { LabelChip } from "./label-chip"
import { useStudentLabels, StudentLabel } from "@/hooks/use-student-labels"
import { PencilIcon, TrashIcon, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ManageLabelsDialog({
  trigger,
  className,
}: {
  trigger: React.ReactNode
  className?: string
}) {
  const { getLabels, updateLabel, deleteLabel, createLabel } = useStudentLabels()
  const [labels, setLabels] = React.useState<StudentLabel[]>([])
  const [loading, setLoading] = React.useState(false)
  const [editing, setEditing] = React.useState<string | null>(null)
  const [editingValue, setEditingValue] = React.useState<{ name: string; color: string }>({ name: "", color: "" })
  const [newName, setNewName] = React.useState("")
  const [newColor, setNewColor] = React.useState("#3B82F6")
  const [creating, setCreating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  React.useEffect(() => {
    setLoading(true)
    getLabels({ includeDeleted: false })
      .then((list) => setLabels(list))
      .finally(() => setLoading(false))
  }, [getLabels])

  function startEdit(label: StudentLabel) {
    setEditing(label.id)
    setEditingValue({ name: label.name, color: label.color })
  }

  async function submitEdit(labelId: string) {
    setLoading(true)
    try {
      await updateLabel(labelId, { ...editingValue })
      setLabels(labels => labels.map(l => l.id === labelId ? { ...l, ...editingValue } : l))
      setEditing(null)
    } finally {
      setLoading(false)
    }
  }

  async function submitDelete(labelId: string) {
    setDeleting(labelId)
    try {
      await deleteLabel(labelId)
      setLabels(list => list.filter(l => l.id !== labelId))
    } finally {
      setDeleting(null)
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const label = await createLabel({ name: newName.trim(), color: newColor })
      setLabels(list => [...list, label])
      setNewName("")
      setNewColor("#3B82F6")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("max-w-lg", className)}>
        <DialogHeader>
          <DialogTitle>Manage labels</DialogTitle>
          <DialogDescription>
            Add, edit, or remove your student labels. Removing (soft-delete) hides the label everywhere but keeps assignments for now.
          </DialogDescription>
        </DialogHeader>
        <form className="flex gap-2 mb-4 items-center" onSubmit={submitCreate}>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1"
            placeholder="New label name"
            disabled={creating}
          />
          <input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="w-8 h-8 p-0 border rounded mr-2 cursor-pointer"
            disabled={creating}
            title="Label color"
          />
          <Button type="submit" size="sm" disabled={creating || !newName.trim()}>
            <PlusIcon className="size-4 mr-1" /> Add
          </Button>
        </form>
        <div className="divide-y border rounded-xl bg-secondary/30 max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-5 text-muted-foreground text-sm">Loading…</div>
          ) : labels.length === 0 ? (
            <div className="p-5 text-muted-foreground text-sm">No labels yet.</div>
          ) : (
            labels.map(label => (
              <div key={label.id} className="flex items-center gap-3 px-4 py-2">
                {editing === label.id ? (
                  <>
                    <Input
                      value={editingValue.name}
                      onChange={e => setEditingValue(c => ({ ...c, name: e.target.value }))}
                      className="w-28"
                      disabled={loading}
                    />
                    <input
                      type="color"
                      value={editingValue.color}
                      onChange={e => setEditingValue(c => ({ ...c, color: e.target.value }))}
                      className="w-8 h-8 p-0 border rounded mr-2 cursor-pointer"
                      disabled={loading}
                    />
                    <Button size="icon" variant="outline" onClick={() => submitEdit(label.id)} disabled={loading || !editingValue.name.trim()} title="Save">
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <LabelChip name={label.name} color={label.color} />
                    <span className="ml-2 text-xs text-muted-foreground">{label.usage_count ?? 0} students</span>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(label)} title="Edit label">
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => submitDelete(label.id)}
                      disabled={deleting === label.id}
                      title="Delete label"
                    >
                      <TrashIcon className="size-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
