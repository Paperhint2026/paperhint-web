import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  GearSixIcon,
  GlobeIcon,
  MonitorPlayIcon,
  PencilIcon,
  SparkleIcon,
  PlusIcon,
  TimerIcon,
  TrashIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Sticker } from "@/components/shared/sticker"
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
import {
  QuestionEditor,
  type QuestionDraft,
} from "@/modules/tests/components/question-editor"
import {
  QUESTION_TYPE_LABEL,
  testLink,
  testStatus,
  type OnlineTest,
  type TestQuestion,
  type TestSettings,
} from "@/modules/tests/types"

/** A one-line human answer summary for the question card. */
function keySummary(q: TestQuestion): string {
  const c = q.online_config
  switch (q.type) {
    case "mcq":
      return (c.correct ?? []).map((i) => (c.options ?? [])[i]).join(", ")
    case "true_false":
      return c.answer ? "True" : "False"
    case "fill_blank":
      return (c.blanks ?? []).map((b) => b[0]).join(" · ")
    case "match":
      return `${(c.left ?? []).length} pairs`
    case "short_answer":
      return "AI-graded, you review"
  }
}

export function TestBuilderPage() {
  const { classSubjectId, testId } = useParams<{
    classSubjectId: string
    testId: string
  }>()
  const navigate = useNavigate()

  const [test, setTest] = useState<OnlineTest | null>(null)
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  const [editorOpen, setEditorOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [editing, setEditing] = useState<TestQuestion | null>(null)
  const [savingQuestion, setSavingQuestion] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchTest = useCallback(async () => {
    if (!testId) return
    setIsLoading(true)
    setError("")
    try {
      const res = await apiClient.get<{ test: OnlineTest; questions: TestQuestion[] }>(
        `/api/online-tests/${testId}`
      )
      setTest(res.test)
      setQuestions(res.questions ?? [])
    } catch (err) {
      if (err instanceof Error && err.message !== "Unauthorized") setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [testId])

  useEffect(() => {
    fetchTest()
  }, [fetchTest])

  const status = test ? testStatus(test) : "draft"
  const link = test ? testLink(test) : null

  const saveQuestion = async (draft: QuestionDraft) => {
    setSavingQuestion(true)
    try {
      if (editing) {
        const res = await apiClient.patch<{ question: TestQuestion; total_marks: number }>(
          `/api/online-tests/${testId}/questions/${editing.id}`,
          draft
        )
        setQuestions((cur) => cur.map((q) => (q.id === editing.id ? res.question : q)))
        setTest((t) => (t ? { ...t, total_marks: res.total_marks } : t))
      } else {
        const res = await apiClient.post<{ question: TestQuestion; total_marks: number }>(
          `/api/online-tests/${testId}/questions`,
          draft
        )
        setQuestions((cur) => [...cur, res.question])
        setTest((t) => (t ? { ...t, total_marks: res.total_marks } : t))
      }
      setEditorOpen(false)
      setEditing(null)
    } catch (err) {
      showError(err, "Couldn't save the question")
    } finally {
      setSavingQuestion(false)
    }
  }

  const removeQuestion = async (q: TestQuestion) => {
    try {
      const res = await apiClient.delete<{ total_marks: number }>(
        `/api/online-tests/${testId}/questions/${q.id}`
      )
      setQuestions((cur) => cur.filter((x) => x.id !== q.id))
      setTest((t) => (t ? { ...t, total_marks: res.total_marks } : t))
    } catch (err) {
      showError(err, "Couldn't remove the question")
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...questions]
    const [item] = next.splice(index, 1)
    next.splice(index + dir, 0, item)
    setQuestions(next)
    try {
      await apiClient.post(`/api/online-tests/${testId}/reorder`, {
        order: next.map((q) => q.id),
      })
    } catch (err) {
      showError(err)
      fetchTest()
    }
  }

  const publish = async () => {
    setPublishing(true)
    try {
      const res = await apiClient.post<{ test: OnlineTest }>(
        `/api/online-tests/${testId}/publish`
      )
      setTest(res.test)
      setShareOpen(true)
    } catch (err) {
      showError(err, "Couldn't publish")
    } finally {
      setPublishing(false)
    }
  }

  const unpublish = async () => {
    setPublishing(true)
    try {
      const res = await apiClient.post<{ test: OnlineTest }>(
        `/api/online-tests/${testId}/unpublish`
      )
      setTest(res.test)
      setShareOpen(false)
      toast.success("Unpublished — the old link no longer works")
    } catch (err) {
      showError(err)
    } finally {
      setPublishing(false)
    }
  }

  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy — long-press the link instead")
    }
  }

  const waShare = useMemo(() => {
    if (!test || !link) return null
    const text = `📝 ${test.exam_name}\n⏱ ${test.duration_minutes} minutes · ${test.total_marks ?? 0} marks\n\nTake the test here:\n${link}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }, [test, link])

  return (
    <div className={cn(PAGE_GUTTER, PAGE_TOP, "flex min-h-full flex-col gap-5 pb-12")}>
      {/* Trail back to the tests list */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          to={`/class/${classSubjectId}/tests`}
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Online Tests
        </Link>
      </nav>

      <LoadingSwap
        loading={isLoading}
        className="flex-1"
        skeleton={
          <div aria-hidden className="flex flex-col gap-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        }
      >
        {error || !test ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="worried" size={88} />
            <p className="text-sm text-muted-foreground">{error || "Test not found"}</p>
            <Button variant="outline" onClick={() => navigate(`/class/${classSubjectId}/tests`)}>
              Back to tests
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Title row */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                  <TimerIcon className="size-6 shrink-0 text-muted-foreground" />
                  <span className="truncate">{test.exam_name}</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  {questions.length} question{questions.length === 1 ? "" : "s"} ·{" "}
                  {test.total_marks ?? 0} marks · {test.duration_minutes} min
                  {status !== "draft" && (
                    <>
                      {" · "}
                      <span className={status === "live" ? "text-primary" : undefined}>
                        {status === "live" ? "Live" : status === "scheduled" ? "Scheduled" : "Closed"}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                  <GearSixIcon className="size-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
                {test.published_at && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/class/${classSubjectId}/tests/${testId}/monitor`)}
                  >
                    <MonitorPlayIcon className="size-4" />
                    <span className="hidden sm:inline">Monitor</span>
                  </Button>
                )}
                {test.published_at ? (
                  <Button size="sm" onClick={() => setShareOpen(true)}>
                    <GlobeIcon className="size-4" />
                    Share link
                  </Button>
                ) : (
                  <Button size="sm" onClick={publish} disabled={publishing || questions.length === 0}>
                    {publishing ? (
                      <CircleNotchIcon className="size-4 animate-spin" />
                    ) : (
                      <GlobeIcon className="size-4" />
                    )}
                    Publish
                  </Button>
                )}
              </div>
            </div>

            {/* Questions */}
            {questions.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-5 py-10 text-center">
                <Sticker name="point" size={96} />
                <p className="max-w-[340px] text-sm text-muted-foreground">
                  Add your first question — MCQ, true/false, fill-in-the-blank,
                  matching or short answer.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => { setEditing(null); setEditorOpen(true) }}>
                    <PlusIcon className="size-3.5" />
                    Add question
                  </Button>
                  <Button variant="outline" onClick={() => setAiOpen(true)}>
                    <SparkleIcon className="size-3.5" />
                    Generate with AI
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <span className="mt-0.5 w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                      {i + 1}.
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="text-sm text-foreground">{q.question_text}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                          {QUESTION_TYPE_LABEL[q.type]}
                        </span>
                        <span className="tabular-nums">{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
                        <span className="truncate">· {keySummary(q)}</span>
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUpIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move down"
                        disabled={i === questions.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDownIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit question"
                        onClick={() => { setEditing(q); setEditorOpen(true) }}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete question"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeQuestion(q)}
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </span>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setEditing(null); setEditorOpen(true) }}
                  >
                    <PlusIcon className="size-3.5" />
                    Add question
                  </Button>
                  {!test.published_at && (
                    <Button variant="outline" onClick={() => setAiOpen(true)}>
                      <SparkleIcon className="size-3.5" />
                      Generate with AI
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </LoadingSwap>

      <QuestionEditor
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o)
          if (!o) setEditing(null)
        }}
        initial={editing}
        saving={savingQuestion}
        onSave={saveQuestion}
      />

      {test && (
        <TestSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          test={test}
          hasWrittenQuestions={questions.some((q) => q.type === "short_answer")}
          onSaved={(t) => setTest(t)}
        />
      )}

      {test && (
        <AIGenerateDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          testId={test.id}
          onGenerated={(qs, totalMarks, skipped) => {
            setQuestions((cur) => [...cur, ...qs])
            setTest((t) => (t ? { ...t, total_marks: totalMarks } : t))
            toast.success(
              `Added ${qs.length} question${qs.length === 1 ? "" : "s"}` +
                (skipped > 0 ? ` (${skipped} unusable — dropped)` : "")
            )
            setAiOpen(false)
          }}
        />
      )}

      {/* Share / publish state */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test link</DialogTitle>
            <DialogDescription>
              Anyone in the batch opens this on their phone, picks their name
              and starts. The timer runs on the server — closing the page
              doesn't pause it.
            </DialogDescription>
          </DialogHeader>
          {link && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={link} className="font-mono text-xs" />
                <Button variant="outline" size="icon" aria-label="Copy link" onClick={copyLink}>
                  {copied ? <CheckIcon className="size-4 text-primary" /> : <CopyIcon className="size-4" />}
                </Button>
              </div>
              {waShare && (
                <Button variant="outline" asChild>
                  <a href={waShare} target="_blank" rel="noreferrer">
                    <WhatsappLogoIcon className="size-4" />
                    Share on WhatsApp
                  </a>
                </Button>
              )}
            </div>
          )}
          <DialogFooter className="justify-between gap-2 sm:justify-between">
            <Button variant="ghost" className="text-destructive" onClick={unpublish} disabled={publishing}>
              Unpublish
            </Button>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── settings ──────────────────────────────────────────────────────────────────

const FRACTIONS = [
  { value: "0.25", label: "¼ of the question's marks" },
  { value: "0.33", label: "⅓ of the question's marks" },
  { value: "0.5", label: "½ of the question's marks" },
  { value: "1", label: "Full marks of the question" },
]

function toLocalInput(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function TestSettingsDialog({
  open,
  onOpenChange,
  test,
  hasWrittenQuestions,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  test: OnlineTest
  /** No short-answer questions → the grading-mode choice is moot, hide it.
   *  (The server never calls — or meters — the AI on such tests anyway.) */
  hasWrittenQuestions: boolean
  onSaved: (t: OnlineTest) => void
}) {
  const [duration, setDuration] = useState(test.duration_minutes ?? 30)
  const [opensAt, setOpensAt] = useState(toLocalInput(test.opens_at))
  const [closesAt, setClosesAt] = useState(toLocalInput(test.closes_at))
  const [s, setS] = useState<TestSettings>(test.test_settings)
  const [saving, setSaving] = useState(false)

  // Re-seed when (re)opened for the latest server state.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDuration(test.duration_minutes ?? 30)
      setOpensAt(toLocalInput(test.opens_at))
      setClosesAt(toLocalInput(test.closes_at))
      setS(test.test_settings)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiClient.patch<{ test: OnlineTest }>(
        `/api/online-tests/${test.id}`,
        {
          duration_minutes: duration,
          opens_at: opensAt ? new Date(opensAt).toISOString() : null,
          closes_at: closesAt ? new Date(closesAt).toISOString() : null,
          settings: s,
        }
      )
      onSaved(res.test)
      onOpenChange(false)
      toast.success("Settings saved")
    } catch (err) {
      showError(err, "Couldn't save settings")
    } finally {
      setSaving(false)
    }
  }

  const row = "flex items-center justify-between gap-3"

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Test settings</DialogTitle>
          <DialogDescription>
            The timer is enforced on the server; shuffling is per student.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className={row}>
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={1}
              max={600}
              className="w-24"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Open window (optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                aria-label="Opens at"
              />
              <Input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                aria-label="Closes at"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave empty to keep the link open until you unpublish.
            </p>
          </div>

          {(
            [
              ["shuffle_questions", "Shuffle question order per student"],
              ["shuffle_options", "Shuffle MCQ options per student"],
              ["allow_back", "Allow going back to earlier questions"],
              ["instant_results", "Show the score right after submitting"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={cn(row, "cursor-pointer")}>
              <span>{label}</span>
              <Checkbox
                checked={s[key]}
                onCheckedChange={(v) => setS((cur) => ({ ...cur, [key]: !!v }))}
              />
            </label>
          ))}

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <label className={cn(row, "cursor-pointer")}>
              <span className="font-medium">Negative marking</span>
              <Checkbox
                checked={s.negative_marking.enabled}
                onCheckedChange={(v) =>
                  setS((cur) => ({
                    ...cur,
                    negative_marking: { ...cur.negative_marking, enabled: !!v },
                  }))
                }
              />
            </label>
            {s.negative_marking.enabled && (
              <Select
                value={String(s.negative_marking.fraction)}
                onValueChange={(v) =>
                  setS((cur) => ({
                    ...cur,
                    negative_marking: { ...cur.negative_marking, fraction: Number(v) },
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FRACTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      Deduct {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {hasWrittenQuestions && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="font-medium">Written answers</p>
            <Select
              value={s.short_answer_grading ?? "ai"}
              onValueChange={(v) =>
                setS((cur) => ({
                  ...cur,
                  short_answer_grading: v as TestSettings["short_answer_grading"],
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai">AI grades them, you review</SelectItem>
                <SelectItem value="manual">You grade them yourself</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {(s.short_answer_grading ?? "ai") === "ai"
                ? "Each submitted attempt with written answers uses 1 grading credit — same as a scanned sheet. MCQ, true/false, fill-in and matching are always checked free."
                : "Free — you mark every written answer from the attempt report. Objective questions still check themselves."}
            </p>
          </div>
          )}

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="font-medium">Camera checks</p>
            <Select
              value={s.camera_policy}
              onValueChange={(v) =>
                setS((cur) => ({ ...cur, camera_policy: v as TestSettings["camera_policy"] }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off — no camera</SelectItem>
                <SelectItem value="optional">On if the student allows it</SelectItem>
                <SelectItem value="required">Required to take the test</SelectItem>
              </SelectContent>
            </Select>
            {s.camera_policy !== "off" && (
              <p className="text-xs text-muted-foreground">
                Random photos from the front camera land on each attempt's
                report — only you see them. Students are told before they start.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="font-medium">If the student leaves the test tab</p>
            <Select
              value={s.tab_policy.mode}
              onValueChange={(v) =>
                setS((cur) => ({
                  ...cur,
                  tab_policy: { ...cur.tab_policy, mode: v as TestSettings["tab_policy"]["mode"] },
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="log">Just record it for your report</SelectItem>
                <SelectItem value="warn">Warn the student, record it</SelectItem>
                <SelectItem value="auto_submit">Auto-submit after too many</SelectItem>
              </SelectContent>
            </Select>
            {s.tab_policy.mode === "auto_submit" && (
              <div className={row}>
                <span className="text-muted-foreground">Auto-submit after</span>
                <Select
                  value={String(s.tab_policy.max)}
                  onValueChange={(v) =>
                    setS((cur) => ({
                      ...cur,
                      tab_policy: { ...cur.tab_policy, max: Number(v) },
                    }))
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} switch{n === 1 ? "" : "es"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !(duration >= 1)}>
            {saving ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── AI question builder ──────────────────────────────────────────────────────
// Instruction + a mix of types/counts/marks. Generation costs 1 paper
// credit (same as the AI paper builder); typing questions is always free —
// the server enforces both ends of that, this dialog just says it.

const AI_TYPES: { type: keyof typeof QUESTION_TYPE_LABEL; marks: number }[] = [
  { type: "mcq", marks: 1 },
  { type: "true_false", marks: 1 },
  { type: "fill_blank", marks: 1 },
  { type: "match", marks: 3 },
  { type: "short_answer", marks: 3 },
]

function AIGenerateDialog({
  open,
  onOpenChange,
  testId,
  onGenerated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  testId: string
  onGenerated: (qs: TestQuestion[], totalMarks: number, skipped: number) => void
}) {
  const [instruction, setInstruction] = useState("")
  const [counts, setCounts] = useState<Record<string, number>>({ mcq: 5 })
  const [marks, setMarks] = useState<Record<string, number>>(
    () => Object.fromEntries(AI_TYPES.map((t) => [t.type, t.marks]))
  )
  const [generating, setGenerating] = useState(false)

  const total = AI_TYPES.reduce((n, t) => n + (counts[t.type] || 0), 0)

  const generate = async () => {
    if (total === 0 || generating) return
    setGenerating(true)
    try {
      const mix: Record<string, { count: number; marks: number }> = {}
      for (const t of AI_TYPES) {
        if ((counts[t.type] || 0) > 0) {
          mix[t.type] = { count: counts[t.type], marks: marks[t.type] || 1 }
        }
      }
      const res = await apiClient.post<{
        questions: TestQuestion[]
        total_marks: number
        skipped: { reason: string }[]
      }>(`/api/online-tests/${testId}/ai-generate`, {
        instruction: instruction.trim(),
        mix,
      })
      onGenerated(res.questions, res.total_marks, res.skipped?.length ?? 0)
      setInstruction("")
    } catch (err) {
      showError(err, "Couldn't generate the questions")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !generating && onOpenChange(o)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate questions with AI</DialogTitle>
          <DialogDescription>
            Hint reads your uploaded materials for this batch and writes the
            questions with answer keys — you review and edit before publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <Label>What should it cover?</Label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Chapter 12 — Electricity: Ohm's law, series vs parallel circuits. Moderate difficulty, JEE foundation level."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>How many of each?</Label>
            {AI_TYPES.map((t) => (
              <div key={t.type} className="flex items-center gap-2">
                <span className="w-36 shrink-0 text-xs text-secondary-foreground">
                  {QUESTION_TYPE_LABEL[t.type]}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  className="h-8 w-16 text-xs"
                  value={counts[t.type] ?? 0}
                  onChange={(e) =>
                    setCounts((c) => ({ ...c, [t.type]: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  aria-label={`Number of ${QUESTION_TYPE_LABEL[t.type]} questions`}
                />
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  max={100}
                  className="h-8 w-16 text-xs"
                  value={marks[t.type] ?? 1}
                  onChange={(e) =>
                    setMarks((m) => ({ ...m, [t.type]: Number(e.target.value) || 1 }))
                  }
                  aria-label={`Marks per ${QUESTION_TYPE_LABEL[t.type]} question`}
                />
                <span className="text-xs text-muted-foreground">marks</span>
              </div>
            ))}
          </div>

          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Generating uses <span className="font-medium text-foreground">1 paper credit</span>
            {" "}— the same as building a question paper. Typing questions yourself is always free.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={generate} disabled={total === 0 || total > 30 || generating}>
            {generating ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                Writing {total} questions… ~30s
              </>
            ) : (
              <>
                <SparkleIcon className="size-4" />
                Generate {total || ""} question{total === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
