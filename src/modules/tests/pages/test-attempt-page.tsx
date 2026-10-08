import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PaperPlaneRightIcon,
  TimerIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
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

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

/**
 * The no-login test page students open from a shared link (/t/:token).
 * Phone-first and deliberately bare — no app chrome. The server owns the
 * truth: it shuffles, it keeps the deadline, it grades; this page renders
 * questions, autosaves every answer and counts down for display only.
 */

// ── server shapes ─────────────────────────────────────────────────────────────

interface TestMeta {
  name: string
  duration_minutes: number
  total_marks: number | null
  question_count: number
  state: "open" | "not_open" | "closed"
  opens_at: string | null
  closes_at: string | null
  batch: string | null
  camera_policy: "off" | "optional" | "required"
}

interface RosterStudent {
  id: string
  full_name: string
}

interface PublicQuestion {
  id: string
  type: "mcq" | "true_false" | "fill_blank" | "match" | "short_answer"
  question_text: string
  marks: number
  options?: { i: number; text: string }[]
  multi?: boolean
  blanks?: number
  left?: string[]
  right?: { i: number; text: string }[]
}

type Answer = {
  selected?: number[]
  answer?: boolean
  texts?: string[]
  map?: (number | null)[]
  text?: string
}

interface AttemptState {
  attempt_token: string
  status: "in_progress"
  deadline_at: string
  server_now: string
  allow_back: boolean
  instant_results: boolean
  tab_policy: { mode: "log" | "warn" | "auto_submit"; max: number }
  camera_policy: "off" | "optional" | "required"
  violation_count: number
  questions: PublicQuestion[]
  answers: Record<string, Answer>
}

interface ResultState {
  status: "submitted"
  auto_submitted?: boolean
  instant_results: boolean
  score?: number
  total_marks?: number | null
  pending_review_count?: number
}

const storageKey = (token: string) => `ph_attempt_${token}`

function answered(q: PublicQuestion, a: Answer | undefined): boolean {
  if (!a) return false
  switch (q.type) {
    case "mcq":
      return (a.selected ?? []).length > 0
    case "true_false":
      return typeof a.answer === "boolean"
    case "fill_blank":
      return (a.texts ?? []).some((t) => t && t.trim())
    case "match":
      return (a.map ?? []).some((v) => v != null)
    case "short_answer":
      return Boolean(a.text && a.text.trim())
  }
}

// ── page ──────────────────────────────────────────────────────────────────────

export function TestAttemptPage() {
  const { token } = useParams<{ token: string }>()
  const [phase, setPhase] = useState<"loading" | "missing" | "landing" | "attempt" | "result">(
    "loading"
  )
  const [meta, setMeta] = useState<TestMeta | null>(null)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [attempt, setAttempt] = useState<AttemptState | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)

  const adoptResponse = useCallback(
    (body: AttemptState | ResultState) => {
      if (body.status === "submitted") {
        setResult(body as ResultState)
        setPhase("result")
      } else {
        const a = body as AttemptState
        setAttempt(a)
        try {
          localStorage.setItem(storageKey(token!), a.attempt_token)
        } catch {
          /* private mode — resume just won't survive a reload */
        }
        setPhase("attempt")
      }
    },
    [token]
  )

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      // A saved attempt resumes straight into the paper or the result.
      let saved: string | null = null
      try {
        saved = localStorage.getItem(storageKey(token))
      } catch {
        saved = null
      }
      if (saved) {
        const r = await fetch(`${BASE_URL}/api/public/tests/attempt/${saved}`)
        if (!cancelled && r.ok) {
          adoptResponse(await r.json())
          return
        }
      }
      const r = await fetch(`${BASE_URL}/api/public/tests/${token}`)
      if (cancelled) return
      if (!r.ok) {
        setPhase("missing")
        return
      }
      const body = await r.json()
      setMeta(body.test)
      setRoster(body.students ?? [])
      setPhase("landing")
    })().catch(() => !cancelled && setPhase("missing"))
    return () => {
      cancelled = true
    }
  }, [token, adoptResponse])

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-8">
        {phase === "loading" && (
          <div className="flex flex-col gap-3 pt-10">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {phase === "missing" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <TimerIcon className="size-10 text-muted-foreground" />
            <p className="text-base font-medium">This test link isn't active</p>
            <p className="text-sm text-muted-foreground">
              Ask your teacher for the latest link.
            </p>
          </div>
        )}

        {phase === "landing" && meta && token && (
          <Landing token={token} meta={meta} roster={roster} onStarted={adoptResponse} />
        )}

        {phase === "attempt" && attempt && (
          <Attempt
            key={attempt.attempt_token}
            attempt={attempt}
            onFinished={(r) => {
              setResult(r)
              setPhase("result")
            }}
          />
        )}

        {phase === "result" && result && <Result result={result} />}
      </div>
    </div>
  )
}

// ── landing: pick your name ──────────────────────────────────────────────────

function Landing({
  token,
  meta,
  roster,
  onStarted,
}: {
  token: string
  meta: TestMeta
  roster: RosterStudent[]
  onStarted: (body: AttemptState | ResultState) => void
}) {
  const [query, setQuery] = useState("")
  const [studentId, setStudentId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState("")

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? roster.filter((s) => s.full_name.toLowerCase().includes(q)) : roster
  }, [roster, query])

  const start = async () => {
    if (!studentId || starting) return
    setStarting(true)
    setError("")
    try {
      const r = await fetch(`${BASE_URL}/api/public/tests/${token}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      })
      const body = await r.json()
      if (!r.ok) {
        setError(body.error || "Couldn't start the test")
        return
      }
      onStarted(body)
    } catch {
      setError("Network problem — check your connection and try again")
    } finally {
      setStarting(false)
    }
  }

  const blocked = meta.state !== "open"

  return (
    <div className="flex flex-col gap-5 pt-8">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {meta.batch ?? "Online test"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.name}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <ClockIcon className="size-4" />
            {meta.duration_minutes} minutes
          </span>
          <span>{meta.question_count} questions</span>
          {meta.total_marks ? <span>{meta.total_marks} marks</span> : null}
        </p>
      </div>

      {blocked ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {meta.state === "not_open"
            ? `This test hasn't opened yet${meta.opens_at ? ` — it opens ${new Date(meta.opens_at).toLocaleString()}` : ""}.`
            : "This test window has closed."}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Who are you?</p>
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your name…"
                className="pl-9"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
              {visible.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No name matches — ask your teacher to add you.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {visible.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setStudentId(s.id)}
                        className={cn(
                          "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors",
                          studentId === s.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50"
                        )}
                      >
                        {s.full_name}
                        {studentId === s.id && <CheckCircleIcon weight="fill" className="size-4" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button size="lg" onClick={start} disabled={!studentId || starting}>
            {starting ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
            Start the test
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            The timer starts the moment you tap Start and keeps running even if
            you close this page. Answers save automatically.
            {meta.camera_policy !== "off" && (
              <>
                {" "}
                <span className="font-medium text-foreground">
                  This test takes photos from your front camera while you
                  write{meta.camera_policy === "required" ? " — the camera is required" : ""}.
                </span>{" "}
                Only your teacher sees them.
              </>
            )}
          </p>
        </>
      )}
    </div>
  )
}

// ── the attempt ───────────────────────────────────────────────────────────────

function Attempt({
  attempt,
  onFinished,
}: {
  attempt: AttemptState
  onFinished: (r: ResultState) => void
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(attempt.answers)
  const [index, setIndex] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline">("idle")
  const [violations, setViolations] = useState(attempt.violation_count || 0)
  const [cameraState, setCameraState] = useState<"off" | "starting" | "on" | "denied">(
    attempt.camera_policy === "off" ? "off" : "starting"
  )

  const questions = attempt.questions
  const q = questions[index]

  // Display countdown pinned to the server clock: offset computed once so a
  // wrong phone clock doesn't change the deadline we show.
  const deadlineMs = useMemo(
    () => Date.now() + (new Date(attempt.deadline_at).getTime() - new Date(attempt.server_now).getTime()),
    [attempt.deadline_at, attempt.server_now]
  )
  const [leftMs, setLeftMs] = useState(deadlineMs - Date.now())
  const expiredRef = useRef(false)

  const submit = useCallback(
    async (auto = false) => {
      if (submitting) return
      setSubmitting(true)
      try {
        const r = await fetch(
          `${BASE_URL}/api/public/tests/attempt/${attempt.attempt_token}/submit`,
          { method: "POST", headers: { "Content-Type": "application/json" } }
        )
        const body = await r.json()
        if (r.ok) onFinished({ ...body, auto_submitted: body.auto_submitted || auto })
      } finally {
        setSubmitting(false)
      }
    },
    [attempt.attempt_token, onFinished, submitting]
  )

  useEffect(() => {
    const id = setInterval(() => {
      const left = deadlineMs - Date.now()
      setLeftMs(left)
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true
        submit(true)
      }
    }, 500)
    return () => clearInterval(id)
  }, [deadlineMs, submit])

  // ── anti-cheat: report leaving the test; the SERVER decides what happens ──
  const lastReport = useRef(0)
  const reportEvent = useCallback(
    async (kind: string, meta?: Record<string, unknown>) => {
      try {
        const r = await fetch(
          `${BASE_URL}/api/public/tests/attempt/${attempt.attempt_token}/event`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, meta }),
          }
        )
        const body = await r.json()
        if (body.status === "submitted") {
          onFinished(body)
          return
        }
        if (typeof body.violation_count === "number") setViolations(body.violation_count)
      } catch {
        /* offline — the gap itself is visible to the teacher */
      }
    },
    [attempt.attempt_token, onFinished]
  )

  useEffect(() => {
    const leave = (kind: "tab_hidden" | "window_blur") => {
      // visibilitychange + blur fire together on a tab switch; one report.
      if (Date.now() - lastReport.current < 1500) return
      lastReport.current = Date.now()
      void reportEvent(kind)
    }
    const onVis = () => {
      if (document.visibilityState === "hidden") leave("tab_hidden")
    }
    const onBlur = () => {
      if (document.visibilityState === "visible") leave("window_blur")
    }
    const onFsChange = () => {
      if (!document.fullscreenElement) void reportEvent("fullscreen_exit")
    }
    const block = (e: Event) => e.preventDefault()
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("blur", onBlur)
    document.addEventListener("fullscreenchange", onFsChange)
    document.addEventListener("copy", block)
    document.addEventListener("paste", block)
    document.addEventListener("contextmenu", block)
    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("blur", onBlur)
      document.removeEventListener("fullscreenchange", onFsChange)
      document.removeEventListener("copy", block)
      document.removeEventListener("paste", block)
      document.removeEventListener("contextmenu", block)
    }
  }, [reportEvent])

  // ── camera: start shot + random shots every 2–4 min, silently ──
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  useEffect(() => {
    if (attempt.camera_policy === "off") return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>

    const capture = async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const canvas = document.createElement("canvas")
      const w = 480
      canvas.width = w
      canvas.height = Math.round((video.videoHeight / video.videoWidth) * w) || 360
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.6))
      if (!blob) return
      const form = new FormData()
      form.set("image", blob, "capture.jpg")
      await fetch(`${BASE_URL}/api/public/tests/attempt/${attempt.attempt_token}/capture`, {
        method: "POST",
        body: form,
      }).catch(() => {})
    }

    const schedule = () => {
      if (stopped) return
      timer = setTimeout(async () => {
        await capture()
        schedule()
      }, 120_000 + Math.random() * 120_000)
    }

    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 } },
          audio: false,
        })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setCameraState("on")
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          setCameraState("denied")
          void reportEvent("camera_off")
        })
        // The identity shot, once the feed has frames.
        setTimeout(capture, 2500)
        schedule()
      } catch {
        setCameraState("denied")
        void reportEvent("camera_denied")
      }
    })()

    return () => {
      stopped = true
      clearTimeout(timer)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [attempt.camera_policy, attempt.attempt_token, reportEvent])

  // Autosave: selections save immediately, typed answers debounce.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const push = useCallback(
    async (questionId: string, answer: Answer) => {
      setSaveState("saving")
      try {
        const r = await fetch(
          `${BASE_URL}/api/public/tests/attempt/${attempt.attempt_token}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question_id: questionId, answer }),
          }
        )
        if (r.status === 409) {
          // expired or already submitted — the server finalised; follow it.
          const s = await fetch(`${BASE_URL}/api/public/tests/attempt/${attempt.attempt_token}`)
          const body = await s.json()
          if (body.status === "submitted") onFinished(body)
          return
        }
        setSaveState(r.ok ? "saved" : "offline")
      } catch {
        setSaveState("offline")
      }
    },
    [attempt.attempt_token, onFinished]
  )

  const setAnswer = (questionId: string, answer: Answer, { debounce = 0 } = {}) => {
    setAnswers((cur) => ({ ...cur, [questionId]: answer }))
    clearTimeout(timers.current[questionId])
    if (debounce > 0) {
      timers.current[questionId] = setTimeout(() => push(questionId, answer), debounce)
    } else {
      void push(questionId, answer)
    }
  }

  const answeredCount = questions.filter((qq) => answered(qq, answers[qq.id])).length
  const mins = Math.max(0, Math.floor(leftMs / 60000))
  const secs = Math.max(0, Math.floor((leftMs % 60000) / 1000))
  const urgent = leftMs < 60_000
  const policy = attempt.tab_policy

  return (
    <div className="flex flex-1 flex-col gap-4 select-none">
      {/* The camera feed stays mounted (hidden) so captures have frames. */}
      {attempt.camera_policy !== "off" && (
        <video ref={videoRef} muted playsInline className="pointer-events-none fixed -top-full -left-full size-px opacity-0" />
      )}

      {/* Required camera, no feed: the attempt pauses visually (the timer
          keeps running — the server doesn't pause) until it's allowed. */}
      {attempt.camera_policy === "required" && cameraState === "denied" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 px-6 text-center backdrop-blur">
          <p className="text-base font-medium">Camera needed</p>
          <p className="max-w-[300px] text-sm text-muted-foreground">
            Your teacher requires the camera for this test. Allow camera access
            in your browser — the timer is still running.
          </p>
          <Button onClick={() => window.location.reload()}>I've allowed it — continue</Button>
        </div>
      )}
      {/* Sticky timer bar */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <span className="text-sm text-muted-foreground tabular-nums">
          {index + 1} / {questions.length}
          <span className="ml-2 text-xs">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "offline"
                ? "Offline — retrying on next answer"
                : saveState === "saved"
                  ? "Saved"
                  : ""}
          </span>
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
            urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
          )}
        >
          <TimerIcon className="size-4" />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
      </div>

      {/* Violation standing — shown once something was recorded */}
      {violations > 0 && policy.mode !== "log" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {policy.mode === "auto_submit"
            ? `Leaving the test is recorded — ${violations} of ${policy.max}. At ${policy.max} the test submits itself.`
            : `Leaving the test was recorded (${violations}×). Your teacher will see it.`}
        </div>
      )}

      {/* Question navigator */}
      {attempt.allow_back && (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {questions.map((qq, i) => (
            <button
              key={qq.id}
              type="button"
              aria-label={`Question ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                i === index
                  ? "border-primary bg-primary text-primary-foreground"
                  : answered(qq, answers[qq.id])
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* The question */}
      {q && (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base leading-relaxed font-medium">{q.question_text}</p>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
              {q.marks}m
            </span>
          </div>
          <QuestionInput q={q} value={answers[q.id]} onChange={setAnswer} />
        </div>
      )}

      {/* Nav + submit */}
      <div className="mt-auto flex items-center gap-2 pt-2">
        {attempt.allow_back && (
          <Button
            variant="outline"
            size="lg"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            aria-label="Previous question"
          >
            <CaretLeftIcon className="size-4" />
          </Button>
        )}
        {index < questions.length - 1 ? (
          <Button size="lg" className="flex-1" onClick={() => setIndex((i) => i + 1)}>
            Next
            <CaretRightIcon className="size-4" />
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={() => setConfirmOpen(true)}>
            <PaperPlaneRightIcon className="size-4" />
            Submit test
          </Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit the test?</DialogTitle>
            <DialogDescription>
              You've answered {answeredCount} of {questions.length} questions.
              {answeredCount < questions.length
                ? " Unanswered questions score zero."
                : ""}{" "}
              You can't change answers after submitting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Keep going
            </Button>
            <Button onClick={() => submit(false)} disabled={submitting}>
              {submitting ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── per-type inputs ──────────────────────────────────────────────────────────

function QuestionInput({
  q,
  value,
  onChange,
}: {
  q: PublicQuestion
  value: Answer | undefined
  onChange: (questionId: string, answer: Answer, opts?: { debounce?: number }) => void
}) {
  if (q.type === "mcq") {
    const selected = new Set(value?.selected ?? [])
    const pick = (i: number) => {
      const next = q.multi
        ? selected.has(i)
          ? [...selected].filter((x) => x !== i)
          : [...selected, i]
        : [i]
      onChange(q.id, { selected: next.sort((a, b) => a - b) })
    }
    return (
      <div className="flex flex-col gap-2">
        {q.multi && (
          <p className="text-xs text-muted-foreground">Pick every answer that applies.</p>
        )}
        {(q.options ?? []).map((o) => (
          <button
            key={o.i}
            type="button"
            onClick={() => pick(o.i)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
              selected.has(o.i)
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border hover:bg-muted/50"
            )}
          >
            {o.text}
            {selected.has(o.i) && <CheckCircleIcon weight="fill" className="size-4 shrink-0" />}
          </button>
        ))}
      </div>
    )
  }

  if (q.type === "true_false") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(q.id, { answer: v })}
            className={cn(
              "rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
              value?.answer === v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted/50"
            )}
          >
            {v ? "True" : "False"}
          </button>
        ))}
      </div>
    )
  }

  if (q.type === "fill_blank") {
    const texts = value?.texts ?? []
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: q.blanks ?? 1 }).map((_, i) => (
          <Input
            key={i}
            value={texts[i] ?? ""}
            placeholder={(q.blanks ?? 1) > 1 ? `Blank ${i + 1}` : "Your answer"}
            onChange={(e) => {
              const next = [...texts]
              next[i] = e.target.value
              onChange(q.id, { texts: next }, { debounce: 600 })
            }}
          />
        ))}
      </div>
    )
  }

  if (q.type === "match") {
    const map = value?.map ?? []
    return (
      <div className="flex flex-col gap-2.5">
        {(q.left ?? []).map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm">{l}</span>
            <Select
              value={map[i] != null ? String(map[i]) : ""}
              onValueChange={(v) => {
                const next = [...map]
                while (next.length < (q.left ?? []).length) next.push(null)
                next[i] = Number(v)
                onChange(q.id, { map: next })
              }}
            >
              <SelectTrigger className="w-40 shrink-0">
                <SelectValue placeholder="Match…" />
              </SelectTrigger>
              <SelectContent>
                {(q.right ?? []).map((r) => (
                  <SelectItem key={r.i} value={String(r.i)}>
                    {r.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    )
  }

  // short_answer
  return (
    <Textarea
      value={value?.text ?? ""}
      rows={5}
      placeholder="Write your answer…"
      onChange={(e) => onChange(q.id, { text: e.target.value }, { debounce: 800 })}
    />
  )
}

// ── result ───────────────────────────────────────────────────────────────────

function Result({ result }: { result: ResultState }) {
  const pct =
    result.score != null && result.total_marks
      ? Math.round((result.score / result.total_marks) * 100)
      : null
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <CheckCircleIcon weight="fill" className="size-14 text-primary" />
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">
          {result.auto_submitted ? "Time's up — test submitted" : "Test submitted"}
        </h1>
        {result.instant_results && result.score != null ? (
          <>
            <p className="text-4xl font-bold tracking-tight tabular-nums">
              {result.score}
              <span className="text-xl text-muted-foreground"> / {result.total_marks}</span>
            </p>
            {pct != null && <p className="text-sm text-muted-foreground">{pct}%</p>}
            {(result.pending_review_count ?? 0) > 0 && (
              <p className="mt-2 max-w-[300px] text-sm text-muted-foreground">
                {result.pending_review_count} written answer
                {result.pending_review_count === 1 ? "" : "s"} will be marked by your
                teacher and added to this score.
              </p>
            )}
          </>
        ) : (
          <p className="max-w-[300px] text-sm text-muted-foreground">
            Your answers are in. Your teacher will share the results.
          </p>
        )}
      </div>
    </div>
  )
}
