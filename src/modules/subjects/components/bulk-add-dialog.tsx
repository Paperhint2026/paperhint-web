import { useState } from "react"
import { CircleNotchIcon, UploadSimpleIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { describeGrades } from "@/lib/grades"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Result = {
  name: string
  grades: number[]
  existed: boolean
  department: string | null
  reason: string
}
type Response = {
  preview: boolean
  added: number
  matched: number
  unplaced: number
  results: Result[]
}

const SAMPLE = `Physics 11, 12
Chemistry: 11-12
Business Studies 11,12
Environmental Science 1-5
Music`

/**
 * Paste the school's subject list rather than typing it one at a time. Nothing
 * is written until the plan has been read: the preview says, for every line,
 * which grades were understood and which department it will land in, and why.
 */
export function BulkAddDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [plan, setPlan] = useState<Response | null>(null)
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null)

  const close = (v: boolean) => {
    setOpen(v)
    if (!v) {
      setText("")
      setPlan(null)
    }
  }

  const run = async (preview: boolean) => {
    setBusy(preview ? "preview" : "apply")
    try {
      const r = await apiClient.post<Response>("/api/subjects/bulk", {
        text,
        preview,
      })
      if (preview) {
        setPlan(r)
      } else {
        toast.success(
          `${r.added} added, ${r.matched} already there` +
            (r.unplaced > 0 ? `, ${r.unplaced} with no department` : "")
        )
        close(false)
        onDone()
      }
    } catch (e) {
      showError(e)
    } finally {
      setBusy(null)
    }
  }

  const lineCount = text.split("\n").filter((l) => l.trim()).length

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <UploadSimpleIcon className="size-4" />
          Paste a list
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add many subjects</DialogTitle>
          <DialogDescription>
            One per line. Put the grades after the name if you have them — a
            comma, a colon or a dash all work.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bulk-subjects" className="text-xs">
              Subjects
            </Label>
            <Textarea
              id="bulk-subjects"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setPlan(null)
              }}
              placeholder={SAMPLE}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {lineCount === 0
                ? "Nothing yet."
                : `${lineCount} ${lineCount === 1 ? "line" : "lines"}.`}{" "}
              Each finds its own department; you can change any of them after.
            </p>
          </div>

          {plan && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">
                    {plan.results.length - plan.matched}
                  </span>{" "}
                  new
                </span>
                <span>
                  <span className="font-medium text-foreground">
                    {plan.matched}
                  </span>{" "}
                  already there
                </span>
                {plan.unplaced > 0 && (
                  <span>
                    <span className="font-medium text-foreground">
                      {plan.unplaced}
                    </span>{" "}
                    with no department
                  </span>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Subject</th>
                      <th className="px-3 py-2 font-medium">Grades</th>
                      <th className="px-3 py-2 font-medium">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {plan.results.map((r, i) => (
                      <tr key={`${r.name}-${i}`}>
                        <td className="px-3 py-2">
                          <span className="text-foreground">{r.name}</span>
                          {r.existed && (
                            <span className="ml-1.5 text-[11px] text-muted-foreground">
                              already there
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {describeGrades(r.grades, "—")}
                        </td>
                        <td className="px-3 py-2">
                          {r.department ? (
                            <span className="text-foreground">
                              {r.department}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              none — {r.reason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          {plan ? (
            <Button onClick={() => run(false)} disabled={busy !== null}>
              {busy === "apply" && (
                <CircleNotchIcon className="size-4 animate-spin" />
              )}
              Add {plan.results.length - plan.matched} subjects
            </Button>
          ) : (
            <Button
              onClick={() => run(true)}
              disabled={lineCount === 0 || busy !== null}
            >
              {busy === "preview" && (
                <CircleNotchIcon className="size-4 animate-spin" />
              )}
              Check the list
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
