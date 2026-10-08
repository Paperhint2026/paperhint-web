import { useMemo, useRef, useState } from "react"
import {
  CheckCircleIcon,
  CircleNotchIcon,
  DownloadSimpleIcon,
  FileArrowUpIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { classCode } from "@/hooks/use-teacher-assignments"
import type { ClassItem } from "@/modules/students/components/student-class-card"

interface ImportRow {
  row: number
  full_name: string
  class_label: string | null
  status: "ok" | "error" | "duplicate"
  error: string | null
}

interface ImportResponse {
  preview?: boolean
  summary: { total: number; ok: number; errors: number; duplicates: number }
  rows: ImportRow[]
  created?: { students: number; guardians: number }
}

/**
 * Bulk student import: pick a CSV/XLSX, the server parses + resolves the
 * class column automatically (batch labels for coaching, "6A" spellings for
 * school/solo), the preview shows every row's fate BEFORE anything is
 * written, then one click commits the valid rows. Parent columns create
 * guardian contacts in the same pass.
 */
export function ImportStudentsDialog({
  open,
  onOpenChange,
  classes,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classes: ClassItem[]
  onImported: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  // "" = match each row's Class column; a class id = put EVERY row in it.
  const [targetClassId, setTargetClassId] = useState<string>("")
  const [preview, setPreview] = useState<ImportResponse | null>(null)
  const [busy, setBusy] = useState<null | "preview" | "commit">(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const labels = useMemo(() => classes.map((c) => classCode(c)), [classes])

  const reset = () => {
    setFile(null)
    setPreview(null)
    setTargetClassId("")
  }

  const run = async (mode: "preview" | "commit") => {
    if (!file || busy) return
    setBusy(mode)
    try {
      const form = new FormData()
      form.set("file", file, file.name)
      if (targetClassId) form.set("target_class_id", targetClassId)
      const res = await apiClient.post<ImportResponse>(
        `/api/students/import${mode === "preview" ? "?preview=true" : ""}`,
        form
      )
      if (mode === "preview") {
        setPreview(res)
      } else {
        toast.success(
          `Imported ${res.created?.students ?? 0} student${(res.created?.students ?? 0) === 1 ? "" : "s"}` +
            ((res.created?.guardians ?? 0) > 0 ? ` and ${res.created?.guardians} parent contact${res.created?.guardians === 1 ? "" : "s"}` : "")
        )
        reset()
        onOpenChange(false)
        onImported()
      }
    } catch (err) {
      showError(err, mode === "preview" ? "Couldn't read the file" : "Import failed")
    } finally {
      setBusy(null)
    }
  }

  const downloadTemplate = () => {
    const sampleClass = labels[0] ?? "6A"
    const csv = [
      "Name,Class,Roll No,Parent Name,Parent Phone,Parent Email,Language",
      `Aarav Sharma,${sampleClass},1,Ravi Sharma,+919800000001,ravi@example.com,Tamil`,
      `Priya Iyer,${labels[1] ?? sampleClass},2,Meena Iyer,+919800000002,,Hindi`,
    ].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "paperhint-students-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusIcon = (s: ImportRow["status"]) =>
    s === "ok" ? (
      <CheckCircleIcon weight="fill" className="size-4 text-primary" />
    ) : s === "duplicate" ? (
      <WarningIcon weight="fill" className="size-4 text-amber-500" />
    ) : (
      <XCircleIcon weight="fill" className="size-4 text-destructive" />
    )

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import students</DialogTitle>
          <DialogDescription>
            A CSV or Excel file — a Name column is all it needs. Parent name and
            phone columns become WhatsApp-ready contacts. Nothing is saved until
            you confirm the preview.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                setPreview(null)
                e.target.value = ""
              }}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={!!busy}>
              <FileArrowUpIcon className="size-4" />
              {file ? file.name : "Choose file"}
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <DownloadSimpleIcon className="size-4" />
              Download template
            </Button>
          </div>

          {classes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="shrink-0 text-xs text-muted-foreground">Import into</span>
                <Select
                  value={targetClassId || "auto"}
                  onValueChange={(v) => {
                    setTargetClassId(v === "auto" ? "" : v)
                    setPreview(null)
                  }}
                >
                  <SelectTrigger className="h-8 w-full min-w-0 text-xs sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Match each row’s Class column</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {classCode(c)} — everyone goes here
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {targetClassId
                  ? "Every row lands in this one; a Class column in the file is ignored."
                  : `The Class column matches ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? "…" : ""} automatically, in any spelling.`}
              </p>
            </div>
          )}

          {preview && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                  {preview.summary.ok} ready
                </span>
                {preview.summary.duplicates > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
                    {preview.summary.duplicates} duplicate{preview.summary.duplicates === 1 ? "" : "s"} (skipped)
                  </span>
                )}
                {preview.summary.errors > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
                    {preview.summary.errors} error{preview.summary.errors === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {/* Phone: one stacked line per row. Wider: the table. A 4-column
                  table at 375px forced the whole dialog sideways. */}
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border sm:hidden">
                {preview.rows.map((r) => (
                  <li
                    key={r.row}
                    className={cn(
                      "flex min-w-0 items-start gap-2.5 px-3 py-2 text-xs",
                      r.status === "error" && "bg-destructive/5"
                    )}
                  >
                    <span className="mt-0.5 shrink-0">{statusIcon(r.status)}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate font-medium">{r.full_name || "—"}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                          row {r.row}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-muted-foreground">
                        {r.class_label ?? "—"}
                        {r.error ? ` · ${r.error}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="hidden max-h-64 overflow-y-auto rounded-lg border sm:block">
                <table className="w-full table-fixed text-left text-xs">
                  <colgroup>
                    <col className="w-12" />
                    <col className="w-[30%]" />
                    <col className="w-[24%]" />
                    <col />
                  </colgroup>
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Class</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((r) => (
                      <tr key={r.row} className={cn(r.status === "error" && "bg-destructive/5")}>
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{r.row}</td>
                        <td className="truncate px-3 py-1.5">{r.full_name || "—"}</td>
                        <td className="truncate px-3 py-1.5">{r.class_label ?? "—"}</td>
                        <td className="px-3 py-1.5">
                          <span className="flex min-w-0 items-center gap-1.5" title={r.error ?? undefined}>
                            <span className="shrink-0">{statusIcon(r.status)}</span>
                            <span className="truncate text-muted-foreground">
                              {r.error ?? "Ready"}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!busy}>
            Cancel
          </Button>
          {!preview ? (
            <Button onClick={() => void run("preview")} disabled={!file || !!busy}>
              {busy === "preview" ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
              Preview
            </Button>
          ) : (
            <Button onClick={() => void run("commit")} disabled={preview.summary.ok === 0 || !!busy}>
              {busy === "commit" ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
              Import {preview.summary.ok} student{preview.summary.ok === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
