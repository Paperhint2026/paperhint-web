// src/modules/student-labels/components/label-picker.tsx
import * as React from "react"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LabelChip } from "./label-chip"
import { useStudentLabels, StudentLabel } from "@/hooks/use-student-labels"
import { PlusCircleIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const PRESET_COLORS = [
  "#F97316", // orange
  "#10B981", // green
  "#3B82F6", // blue
  "#F43F5E", // pink/red
  "#6366F1", // indigo
  "#FBBF24", // yellow
  "#A3E635", // lime
  "#6EE7B7", // teal
  "#64748B", // slate
]

export interface LabelPickerProps {
  value: StudentLabel[]
  onChange: (labels: StudentLabel[]) => void
  className?: string
}

export function LabelPicker({ value, onChange, className }: LabelPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [allLabels, setAllLabels] = React.useState<StudentLabel[]>([])
  const [loading, setLoading] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [newName, setNewName] = React.useState("")
  const [newColor, setNewColor] = React.useState(PRESET_COLORS[0])
  const [creating, setCreating] = React.useState(false)
  const { getLabels, createLabel } = useStudentLabels()

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    getLabels()
      .then((labels) => setAllLabels(labels.filter(l => !l.deleted_at)))
      .finally(() => setLoading(false))
  }, [open, getLabels])

  function handleSelect(label: StudentLabel) {
    if (value.some((l) => l.id === label.id)) {
      onChange(value.filter((l) => l.id !== label.id))
    } else {
      onChange([...value, label])
    }
  }

  async function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const label = await createLabel({ name: newName.trim(), color: newColor })
      setAllLabels(al => [...al, label])
      onChange([...value, label])
      setNewName("")
      setNewColor(PRESET_COLORS[0])
    } finally {
      setCreating(false)
    }
  }

  const filteredLabels = allLabels
    .filter(
      (l) =>
        l.name.toLowerCase().includes(search.trim().toLowerCase()) || value.some(v => v.id === l.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("flex flex-wrap gap-1 px-3 min-h-9 items-center w-full text-left justify-start", className)}
          type="button"
        >
          {value.length ? (
            <div className="flex flex-wrap gap-1 max-w-[210px] truncate">
              {value.map((label) => (
                <LabelChip key={label.id} name={label.name} color={label.color} />
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">Pick label…</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[320px] max-w-[90vw]" align="start">
        <PopoverHeader>
          <PopoverTitle>Labels</PopoverTitle>
        </PopoverHeader>
        <Input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2"
          placeholder="Search labels…"
        />
        <div className="flex flex-col gap-1 max-h-52 overflow-y-auto mb-2">
          {loading && <div className="text-muted-foreground text-sm">Loading…</div>}
          {!loading && filteredLabels.length === 0 && (
            <div className="text-muted-foreground text-sm">No labels found.</div>
          )}
          {filteredLabels.map(label => (
            <button
              type="button"
              key={label.id}
              className={cn(
                "w-full text-left flex items-center gap-2 px-2.5 py-1 rounded hover:bg-muted/50 transition-colors",
                value.some(l => l.id === label.id) && "ring-2 ring-primary/40 ring-offset-2 bg-muted"
              )}
              onClick={() => handleSelect(label)}
            >
              <LabelChip
                name={label.name}
                color={label.color}
                className="mr-2"
              />
              <span className="flex-1 truncate text-sm">{label.name}</span>
              {value.some(l => l.id === label.id) && (
                <span className="text-xs text-primary">Selected</span>
              )}
            </button>
          ))}
        </div>
        <form className="mt-3 flex gap-2 items-center" onSubmit={handleCreateLabel}>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1"
            disabled={creating}
            placeholder="New label name"
            data-slot="input"
          />
          <select
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            className="rounded p-1 border appearance-none min-w-8 mr-2"
            style={{ backgroundColor: newColor }}
            title="Label color"
            disabled={creating}
          >
            {PRESET_COLORS.map(col => (
              <option value={col} key={col} style={{ backgroundColor: col }}>
                {col}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            size="sm"
            className="flex-shrink-0 gap-1"
            disabled={creating || !newName.trim()}
          >
            <PlusCircleIcon className="size-4" /> Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
