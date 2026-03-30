import { useRef, useState } from "react"
import {
  Loader2Icon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export interface StudentEntry {
  full_name: string
  roll_number: number | ""
  register_number: string
}

interface AddStudentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (students: StudentEntry[]) => void
  classLabel: string
  isSaving?: boolean
}

const emptyRow: StudentEntry = {
  full_name: "",
  roll_number: "",
  register_number: "",
}

type Mode = "manual" | "csv"

export function AddStudentDrawer({
  open,
  onOpenChange,
  onSave,
  classLabel,
  isSaving = false,
}: AddStudentDrawerProps) {
  const [mode, setMode] = useState<Mode>("manual")
  const [rows, setRows] = useState<StudentEntry[]>([{ ...emptyRow }])
  const [csvError, setCsvError] = useState("")
  const [rollError, setRollError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateRow = (
    index: number,
    field: keyof StudentEntry,
    value: string | number,
  ) => {
    setRows((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setRollError("")
  }

  const addRow = () => {
    setRows((prev) => [...prev, { ...emptyRow }])
  }

  const removeRow = (index: number) => {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError("")
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)

      if (lines.length < 2) {
        setCsvError("CSV must have a header row and at least one data row.")
        return
      }

      const header = lines[0].toLowerCase()
      const hasName =
        header.includes("full_name") || header.includes("name")
      const hasRoll =
        header.includes("roll_number") || header.includes("roll")
      const hasRegister =
        header.includes("register_number") || header.includes("register")

      if (!hasName || !hasRoll || !hasRegister) {
        setCsvError(
          "CSV header must include: full_name, roll_number, register_number",
        )
        return
      }

      const headerCols = lines[0].split(",").map((h) => h.trim().toLowerCase())
      const nameIdx = headerCols.findIndex(
        (h) => h === "full_name" || h === "name",
      )
      const rollIdx = headerCols.findIndex(
        (h) => h === "roll_number" || h === "roll",
      )
      const regIdx = headerCols.findIndex(
        (h) => h === "register_number" || h === "register",
      )

      const parsed: StudentEntry[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim())
        const name = cols[nameIdx] ?? ""
        const roll = parseInt(cols[rollIdx] ?? "", 10)
        const register = cols[regIdx] ?? ""
        if (name) {
          parsed.push({
            full_name: name,
            roll_number: isNaN(roll) ? "" : roll,
            register_number: register,
          })
        }
      }

      if (parsed.length === 0) {
        setCsvError("No valid student rows found in CSV.")
        return
      }

      setRows(parsed)
      setMode("manual")
    }
    reader.readAsText(file)

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const validRows = rows.filter(
    (r) => r.full_name.trim() !== "" && r.roll_number !== "",
  )

  const isFormValid = validRows.length > 0

  const getDuplicateRolls = (): number[] => {
    const rolls = validRows
      .map((r) => r.roll_number)
      .filter((r): r is number => r !== "")
    const seen = new Set<number>()
    const dupes = new Set<number>()
    for (const roll of rolls) {
      if (seen.has(roll)) dupes.add(roll)
      seen.add(roll)
    }
    return Array.from(dupes)
  }

  const handleSave = () => {
    if (validRows.length === 0) return

    const dupes = getDuplicateRolls()
    if (dupes.length > 0) {
      setRollError(
        `Duplicate roll number${dupes.length > 1 ? "s" : ""}: ${dupes.join(", ")}. Each student must have a unique roll number.`,
      )
      return
    }

    setRollError("")
    onSave(validRows)
  }

  const handleClose = () => {
    onOpenChange(false)
    setRows([{ ...emptyRow }])
    setMode("manual")
    setCsvError("")
    setRollError("")
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="ml-auto h-full rounded-none p-0 before:hidden"
        style={{ width: 580, maxWidth: 580 }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 bg-background px-6 py-4">
          <div className="flex flex-1 flex-col">
            <div className="flex items-center gap-2">
              <h2 className="flex-1 truncate text-base font-medium text-secondary-foreground">
                Add Students – {classLabel}
              </h2>
              <DrawerClose asChild>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <XIcon className="size-4" />
                </button>
              </DrawerClose>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              Add students manually or upload a CSV file.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col gap-4 bg-background px-6 py-2">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("manual")}
              >
                <UserPlusIcon className="size-4" />
                Manual Entry
              </Button>
              <Button
                variant={mode === "csv" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("csv")}
              >
                <UploadIcon className="size-4" />
                CSV Upload
              </Button>
            </div>

            <Separator />

            {mode === "csv" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Upload CSV File</Label>
                  <p className="text-xs text-muted-foreground">
                    CSV must have columns: full_name, roll_number,
                    register_number
                  </p>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="cursor-pointer"
                  />
                  {csvError && (
                    <p className="text-xs text-destructive">{csvError}</p>
                  )}
                </div>

                <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
                  <UploadIcon className="mx-auto mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Choose a CSV file to import students
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Students will be previewed before saving
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label>
                    Students ({rows.length})
                  </Label>
                  <Button variant="secondary" size="sm" onClick={addRow}>
                    <PlusIcon className="size-4" />
                    Add Another
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  {rows.map((row, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-2 rounded-lg border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Student {index + 1}
                        </span>
                        {rows.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeRow(index)}
                          >
                            <TrashIcon className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Full Name *</Label>
                          <Input
                            placeholder="John Doe"
                            value={row.full_name}
                            onChange={(e) =>
                              updateRow(index, "full_name", e.target.value)
                            }
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Roll No. *</Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="1"
                            value={row.roll_number}
                            onChange={(e) => {
                              const val = e.target.value
                              updateRow(
                                index,
                                "roll_number",
                                val === "" ? "" : parseInt(val, 10),
                              )
                            }}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Register No.</Label>
                          <Input
                            placeholder="REG001"
                            value={row.register_number}
                            onChange={(e) =>
                              updateRow(
                                index,
                                "register_number",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 bg-background px-6 py-4">
          {rollError && (
            <p className="text-xs text-destructive">{rollError}</p>
          )}
          <Button
            size="lg"
            className="w-full"
            disabled={!isFormValid || isSaving}
            onClick={handleSave}
          >
            {isSaving && <Loader2Icon className="animate-spin" />}
            {isSaving
              ? "Saving..."
              : `Save ${validRows.length} Student${validRows.length !== 1 ? "s" : ""}`}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleClose}
          >
            Close
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
