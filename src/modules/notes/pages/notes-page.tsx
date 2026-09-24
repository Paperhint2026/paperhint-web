import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  BookmarkSimpleIcon,
  CalendarBlankIcon,
  CircleNotchIcon,
  HouseIcon,
  CopyIcon,
  MicrophoneIcon,
  NotePencilIcon,
  PencilSimpleIcon,
  PlusIcon,
  SparkleIcon,
  StopCircleIcon,
  TrashIcon,
  WaveformIcon,
  XIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { ClassPageHeader } from "@/components/layout/class-page-header"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { Skeleton } from "@/components/ui/skeleton"
import { RichNotesEditor } from "@/modules/notes/components/rich-notes-editor"
import { NotesMarkdown } from "@/modules/notes/components/notes-markdown"
import { SyllabusView } from "@/modules/notes/components/syllabus-view"
import { ErrorState } from "@/components/shared/error-state"

interface TeachingNote {
  id: string
  title: string
  topic: string | null
  periods_planned: number
  prompt: string | null
  content_md: string
  planned_for_date: string | null
  planned_period_id: string | null
  planned_period_name: string | null
  created_at: string
}

interface NextIntent {
  type: "continue" | "test" | "revision" | "activity"
  topic: string | null
  detail: string | null
}

interface LessonLog {
  id: string
  teacher_id: string
  date: string
  period_id: string | null
  period_name: string | null
  raw_entry: string
  entry_source: "text" | "voice"
  covered: string[]
  stopped_at: string | null
  homework: string | null
  next_intent: NextIntent | null
  created_at: string
}

interface ClassPeriod {
  id: string
  name: string
  start_time: string | null
  end_time: string | null
}

interface UpcomingSlot {
  date: string
  period_id: string
  period_name: string
  start_time: string | null
}

const INTENT_LABEL: Record<NextIntent["type"], string> = {
  continue: "Continue",
  test: "Test planned",
  revision: "Revision planned",
  activity: "Activity planned",
}

const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date())

/** "Wed 23 Sep · Period 7" for a pinned note, or null when unpinned. */
function plannedLabel(note: TeachingNote) {
  if (!note.planned_for_date) return null
  const day = dayjs(note.planned_for_date).format("ddd D MMM")
  return note.planned_period_name ? `${day} · ${note.planned_period_name}` : day
}

/** Newest day first; entries within a day keep their newest-first order. */
function groupLogsByDate(logs: LessonLog[]) {
  const groups: { date: string; logs: LessonLog[] }[] = []
  for (const log of logs) {
    const last = groups[groups.length - 1]
    if (last && last.date === log.date) last.logs.push(log)
    else groups.push({ date: log.date, logs: [log] })
  }
  return groups
}

function dateHeading(date: string) {
  const d = dayjs(date)
  if (d.isSame(dayjs(), "day")) return "Today"
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return "Yesterday"
  return d.format("ddd, D MMM")
}

type NotesView = "syllabus" | "prepare" | "journal"
const NOTES_VIEWS: NotesView[] = ["syllabus", "prepare", "journal"]

export function NotesPage() {
  const { classSubjectId, view: viewParam } = useParams<{
    classSubjectId: string
    view: string
  }>()
  const navigate = useNavigate()

  // The view IS the URL — /notes/journal etc. — so notifications can land
  // on the exact surface the teacher needs (collect homework → journal,
  // notes ready → prepare) and back/forward work between tabs.
  const view: NotesView = NOTES_VIEWS.includes(viewParam as NotesView)
    ? (viewParam as NotesView)
    : "syllabus"
  const setView = (v: NotesView) =>
    navigate(`/class/${classSubjectId}/notes/${v}`, { replace: true })

  // Arriving FROM a nudge: ?log=<id> names the journal entry the
  // notification quoted — scroll to it and play the spotlight wave.
  const [searchParams, setSearchParams] = useSearchParams()
  const [waveLogId, setWaveLogId] = useState<string | null>(null)
  const [notes, setNotes] = useState<TeachingNote[]>([])
  const [logs, setLogs] = useState<LessonLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown | null>(null)
  // Which note card is expanded — one at a time keeps a long history scannable.
  const [openNoteId, setOpenNoteId] = useState<string>("")
  // The generator folds away once there are notes; a slim row reopens it.
  const [composerOpen, setComposerOpen] = useState(true)

  // Prepare form
  const [topic, setTopic] = useState("")
  const [periods, setPeriods] = useState("1")
  const [prompt, setPrompt] = useState("")
  // "date|period_id" of the slot the notes are FOR — the pre-period reminder
  // then carries exactly these notes. "" = not pinned.
  const [plannedSlot, setPlannedSlot] = useState("")
  const [upcoming, setUpcoming] = useState<UpcomingSlot[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<TeachingNote | null>(null)

  // Per-note edit + refine
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [refineText, setRefineText] = useState("")
  const [refiningId, setRefiningId] = useState<string | null>(null)

  // Journal form
  const [logDate, setLogDate] = useState(todayStr())
  const [logPeriodId, setLogPeriodId] = useState<string>("")
  const [logText, setLogText] = useState("")
  const [dayPeriods, setDayPeriods] = useState<ClassPeriod[]>([])
  const [isSavingLog, setIsSavingLog] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  // The entry came (at least partly) from the mic — kept even after edits so
  // the timeline can show the voice badge.
  const [voiceUsed, setVoiceUsed] = useState(false)
  const [pendingLogDelete, setPendingLogDelete] = useState<LessonLog | null>(null)
  // The composer folds away once there are entries; the row reopens it, and
  // "Speak" reopens it already recording — ten seconds after class, one tap.
  const [journalOpen, setJournalOpen] = useState(true)
  // Set once the teacher picks a period herself — the smart default (latest
  // period that has already started today) must not fight her choice.
  const periodTouchedRef = useRef(false)
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set())
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordStartRef = useRef(0)
  // Loudest moment observed while recording (0-128). Silence hovers near 0;
  // speech peaks well past 20. Used to refuse silent recordings — sending
  // silence to a speech model makes it HALLUCINATE a whole entry.
  const peakLevelRef = useRef(0)
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const fetchAll = useCallback(async (csId: string) => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await apiClient.get<{ notes: TeachingNote[]; logs: LessonLog[] }>(
        `/api/notes/${csId}`
      )
      const list = res.notes ?? []
      setNotes(list)
      setLogs(res.logs ?? [])
      setOpenNoteId((cur) => cur || list[0]?.id || "")
      setComposerOpen(list.length === 0)
      setJournalOpen((res.logs ?? []).length === 0)
    } catch (err) {
      // Show a real error surface in place of the list — silently rendering
      // "No notes yet" on a 500 has misled teachers into thinking a class
      // was blank when the API was actually down.
      setLoadError(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (classSubjectId) void fetchAll(classSubjectId)
  }, [classSubjectId, fetchAll])

  // Spotlight the entry a notification pointed at, once the logs are in.
  useEffect(() => {
    const target = searchParams.get("log")
    if (!target || view !== "journal" || logs.length === 0) return
    if (!logs.some((l) => l.id === target)) {
      // Entry deleted since the nudge — drop the param quietly.
      setSearchParams({}, { replace: true })
      return
    }
    setWaveLogId(target)
    // Let the day groups render, then bring the entry into view.
    requestAnimationFrame(() => {
      document
        .getElementById(`journal-log-${target}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
    // Consume the param so a refresh doesn't replay the animation.
    setSearchParams({}, { replace: true })
    const t = setTimeout(() => setWaveLogId(null), 3200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs.length === 0, view, searchParams])

  // Upcoming slots for the "For" picker — default to the next class.
  useEffect(() => {
    if (!classSubjectId) return
    let cancelled = false
    apiClient
      .get<{ slots: UpcomingSlot[] }>(`/api/notes/${classSubjectId}/upcoming`)
      .then((res) => {
        if (cancelled) return
        const slots = res.slots ?? []
        setUpcoming(slots)
        if (slots.length > 0) {
          setPlannedSlot((cur) => cur || `${slots[0].date}|${slots[0].period_id}`)
        }
      })
      .catch(() => {
        if (!cancelled) setUpcoming([])
      })
    return () => {
      cancelled = true
    }
  }, [classSubjectId])

  // Period options follow the picked date's weekday.
  useEffect(() => {
    if (!classSubjectId || !logDate) return
    let cancelled = false
    apiClient
      .get<{ periods: ClassPeriod[] }>(
        `/api/notes/${classSubjectId}/periods?date=${logDate}`
      )
      .then((res) => {
        if (cancelled) return
        const list = res.periods ?? []
        setDayPeriods(list)
        setLogPeriodId((cur) => {
          if (periodTouchedRef.current && list.some((p) => p.id === cur)) return cur
          // Default: the latest period of this class that has already started
          // today — the one the teacher most likely just walked out of.
          if (logDate !== todayStr()) return ""
          const now = new Date()
          const nowMin = now.getHours() * 60 + now.getMinutes()
          const started = list.filter((p) => {
            const [h, m] = (p.start_time || "").split(":").map(Number)
            return Number.isFinite(h) && h * 60 + (m || 0) <= nowMin
          })
          return started.length ? started[started.length - 1].id : ""
        })
      })
      .catch(() => {
        if (!cancelled) setDayPeriods([])
      })
    return () => {
      cancelled = true
    }
  }, [classSubjectId, logDate])

  // Stop the mic if the teacher navigates away mid-recording.
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      if (levelTimerRef.current) clearInterval(levelTimerRef.current)
      void audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  /* ── Prepare actions ── */

  const handleGenerate = async () => {
    if (!classSubjectId || !topic.trim() || isGenerating) return
    setIsGenerating(true)
    try {
      const [plannedDate, plannedPeriod] = plannedSlot
        ? plannedSlot.split("|")
        : [null, null]
      const res = await apiClient.post<{ note: TeachingNote }>(
        `/api/notes/${classSubjectId}/generate`,
        {
          topic: topic.trim(),
          periods: Number(periods),
          prompt: prompt.trim(),
          planned_for_date: plannedDate,
          planned_period_id: plannedPeriod,
        }
      )
      setNotes((prev) => [res.note, ...prev])
      setOpenNoteId(res.note.id)
      setComposerOpen(false)
      setTopic("")
      setPrompt("")
      toast.success("Notes ready")
    } catch (err) {
      showError(err, "Could not generate notes")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDelete = async (note: TeachingNote) => {
    if (!classSubjectId) return
    try {
      await apiClient.delete(`/api/notes/${classSubjectId}/note/${note.id}`)
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== note.id)
        setOpenNoteId((cur) => (cur === note.id ? (next[0]?.id ?? "") : cur))
        if (next.length === 0) setComposerOpen(true)
        return next
      })
      toast.success("Note deleted")
    } catch (err) {
      showError(err, "Could not delete note")
    }
  }

  const handleCopy = async (note: TeachingNote) => {
    try {
      await navigator.clipboard.writeText(note.content_md)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Could not copy")
    }
  }

  const patchNoteInList = (note: TeachingNote) => {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)))
  }

  const handleSaveEdit = async (note: TeachingNote, markdown: string) => {
    if (!classSubjectId || !markdown.trim()) return
    setIsSavingEdit(true)
    try {
      const res = await apiClient.patch<{ note: TeachingNote }>(
        `/api/notes/${classSubjectId}/note/${note.id}`,
        { content_md: markdown }
      )
      patchNoteInList(res.note)
      setEditingId(null)
      toast.success("Notes updated")
    } catch (err) {
      showError(err, "Could not save the changes")
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleRefine = async (note: TeachingNote) => {
    if (!classSubjectId || !refineText.trim() || refiningId) return
    setRefiningId(note.id)
    try {
      const res = await apiClient.post<{ note: TeachingNote }>(
        `/api/notes/${classSubjectId}/note/${note.id}/refine`,
        { instruction: refineText.trim() }
      )
      patchNoteInList(res.note)
      setRefineText("")
      toast.success("Notes updated")
    } catch (err) {
      showError(err, "Could not refine the notes")
    } finally {
      setRefiningId(null)
    }
  }

  /* ── Journal actions ── */

  const handleSaveTextLog = async () => {
    if (!classSubjectId || !logText.trim() || isSavingLog) return
    setIsSavingLog(true)
    try {
      const form = new FormData()
      form.append("text", logText.trim())
      form.append("source", voiceUsed ? "voice" : "text")
      form.append("date", logDate)
      if (logPeriodId) form.append("period_id", logPeriodId)
      const res = await apiClient.post<{ log: LessonLog }>(
        `/api/notes/${classSubjectId}/log`,
        form
      )
      // period_name comes hydrated only on list — patch it locally.
      const periodName =
        dayPeriods.find((p) => p.id === res.log.period_id)?.name ?? null
      setLogs((prev) => [{ ...res.log, period_name: periodName }, ...prev])
      setLogText("")
      setVoiceUsed(false)
      setJournalOpen(false)
      toast.success("Class logged")
    } catch (err) {
      showError(err, "Could not save the entry")
    } finally {
      setIsSavingLog(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4"
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (recordTimerRef.current) clearInterval(recordTimerRef.current)
        setIsRecording(false)
        setRecordSeconds(0)
        if (levelTimerRef.current) clearInterval(levelTimerRef.current)
        void audioCtxRef.current?.close().catch(() => {})
        audioCtxRef.current = null
        const blob = new Blob(chunks, { type: mimeType })
        // Neither a tap-on-tap-off nor a silent hold ever reaches the AI —
        // speech models hallucinate whole entries from silence.
        const elapsedMs = Date.now() - recordStartRef.current
        if (elapsedMs < 1500 || blob.size < 2000) {
          toast.error("Too short — hold the mic and say what happened")
          return
        }
        if (peakLevelRef.current < 10) {
          toast.error("Couldn't hear anything — check your mic and try again")
          return
        }
        setIsTranscribing(true)
        try {
          const form = new FormData()
          form.append(
            "audio",
            blob,
            mimeType === "audio/webm" ? "note.webm" : "note.m4a"
          )
          // Transcribe only — the text lands in the box for review; nothing
          // is saved until "Log this class".
          const res = await apiClient.post<{ text: string }>(
            `/api/notes/${classSubjectId}/transcribe`,
            form
          )
          setLogText((prev) =>
            prev.trim() ? `${prev.trim()} ${res.text}` : res.text
          )
          setVoiceUsed(true)
        } catch (err) {
          showError(err, "Could not transcribe the recording")
        } finally {
          setIsTranscribing(false)
        }
      }
      // Level meter: sample the waveform while recording, keep the peak.
      peakLevelRef.current = 0
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const audioCtx = new Ctx()
        audioCtxRef.current = audioCtx
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        audioCtx.createMediaStreamSource(stream).connect(analyser)
        const samples = new Uint8Array(analyser.fftSize)
        levelTimerRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(samples)
          let max = 0
          for (const v of samples) {
            const dev = Math.abs(v - 128)
            if (dev > max) max = dev
          }
          if (max > peakLevelRef.current) peakLevelRef.current = max
        }, 150)
      } catch {
        // No metering (old browser) — the duration/size gates still apply,
        // and a peak of 0 must not block: treat as "unknown, allow".
        peakLevelRef.current = 128
      }
      recorderRef.current = recorder
      recorder.start()
      recordStartRef.current = Date.now()
      setIsRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(
        () => setRecordSeconds((s) => s + 1),
        1000
      )
    } catch {
      toast.error("Microphone unavailable — check browser permissions")
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
  }

  const handleDeleteLog = async (log: LessonLog) => {
    if (!classSubjectId) return
    try {
      await apiClient.delete(`/api/notes/${classSubjectId}/log/${log.id}`)
      setLogs((prev) => prev.filter((l) => l.id !== log.id))
      toast.success("Entry deleted")
    } catch (err) {
      showError(err, "Could not delete the entry")
    }
  }

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <ClassPageHeader
        icon={NotePencilIcon}
        title="Notes"
        count={notes.length || undefined}
        description="Prepare lessons with Hint, and log what happened so it remembers where you stopped."
        actions={
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            {(
              [
                { key: "syllabus", label: "Syllabus" },
                { key: "prepare", label: "Prepare" },
                { key: "journal", label: "Journal" },
              ] as const
            ).map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === v.key
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v.label}
                {v.key === "journal" && logs.length > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {logs.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        }
      />

      {view === "prepare" ? (
        <>
          {/* ── Generator: full form, or a slim row once notes exist ── */}
          {composerOpen ? (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">Prepare new notes</p>
                  {notes.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close"
                      className="-mt-1 -mr-1 text-muted-foreground"
                      onClick={() => setComposerOpen(false)}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notes-topic">Topic</Label>
                  <Input
                    id="notes-topic"
                    placeholder="e.g. Reflection of light — laws and ray diagrams"
                    value={topic}
                    maxLength={300}
                    autoFocus={notes.length > 0}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleGenerate()
                    }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>Time available</Label>
                    <Select value={periods} onValueChange={setPeriods}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} period{n > 1 ? "s" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>For</Label>
                    <Select
                      value={plannedSlot || "none"}
                      onValueChange={(v) => setPlannedSlot(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Upcoming class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No particular class</SelectItem>
                        {upcoming.map((s) => (
                          <SelectItem
                            key={`${s.date}|${s.period_id}`}
                            value={`${s.date}|${s.period_id}`}
                          >
                            {dayjs(s.date).format("ddd D MMM")} · {s.period_name}
                            {s.start_time ? ` (${s.start_time.slice(0, 5)})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="notes-prompt">
                    Anything specific?{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    id="notes-prompt"
                    placeholder="e.g. The class is weak in numericals — include 5 practice problems. Keep the recap short."
                    value={prompt}
                    maxLength={2000}
                    rows={2}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => void handleGenerate()}
                    disabled={!topic.trim() || isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <CircleNotchIcon className="size-4 animate-spin" />
                        Preparing notes…
                      </>
                    ) : (
                      <>
                        <SparkleIcon className="size-4" />
                        Prepare notes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PlusIcon className="size-4" />
              </span>
              <span className="font-medium">Prepare new notes</span>
              <span className="hidden text-muted-foreground sm:inline">
                — a topic and how much time you have
              </span>
            </button>
          )}

          {/* ── Notes: one collapsible card each, newest first ── */}
          {loadError ? (
            <ErrorState
              title="Couldn't load your notes"
              error={loadError}
              onRetry={() => classSubjectId && void fetchAll(classSubjectId)}
            />
          ) : isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed py-12 text-center">
              <NotePencilIcon className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">No notes yet</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Your generated lesson notes will collect here, ready to reuse
                next year.
              </p>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={openNoteId}
              onValueChange={(v) => {
                setOpenNoteId(v)
                setEditingId(null)
                setRefineText("")
              }}
              className="gap-3"
            >
              {notes.map((note) => {
                const forLabel = plannedLabel(note)
                const isOpen = openNoteId === note.id
                const isEditingThis = editingId === note.id
                const isRefiningThis = refiningId === note.id
                return (
                  <AccordionItem
                    key={note.id}
                    value={note.id}
                    className={cn(
                      "rounded-xl border bg-card not-last:border-b transition-shadow",
                      isOpen && "shadow-sm"
                    )}
                  >
                    <AccordionTrigger className="items-center gap-3 px-4 py-3 hover:no-underline">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="line-clamp-2 text-sm font-medium leading-snug">
                          {note.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-muted-foreground">
                          <span>{dayjs(note.created_at).format("D MMM")}</span>
                          <span aria-hidden>·</span>
                          <span>
                            {note.periods_planned} period
                            {note.periods_planned > 1 ? "s" : ""}
                          </span>
                          {forLabel && (
                            <Badge
                              variant="secondary"
                              className="gap-1 font-normal"
                            >
                              <CalendarBlankIcon className="size-3" />
                              For {forLabel}
                            </Badge>
                          )}
                        </span>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pb-0">
                      {isEditingThis ? (
                        <div className="border-t">
                          <RichNotesEditor
                            key={note.id}
                            initial={note.content_md}
                            saving={isSavingEdit}
                            onCancel={() => setEditingId(null)}
                            onSave={(md) => void handleSaveEdit(note, md)}
                          />
                        </div>
                      ) : (
                        <>
                          {/* Toolbar: refine on the left, actions on the right;
                              wraps to two rows on a phone. */}
                          <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2">
                            <div className="flex min-w-0 flex-1 basis-56 items-center gap-1.5">
                              <SparkleIcon className="size-4 shrink-0 text-muted-foreground" />
                              <Input
                                placeholder='Ask Hint: "shorten to half", "add 5 MCQs"…'
                                value={isOpen ? refineText : ""}
                                maxLength={1000}
                                disabled={isRefiningThis}
                                className="h-8 min-w-0 border-none bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                                onChange={(e) => setRefineText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void handleRefine(note)
                                }}
                              />
                            </div>
                            <div className="ml-auto flex items-center gap-0.5">
                              <Button
                                size="sm"
                                variant={refineText.trim() ? "default" : "outline"}
                                onClick={() => void handleRefine(note)}
                                disabled={!refineText.trim() || isRefiningThis}
                              >
                                {isRefiningThis ? (
                                  <>
                                    <CircleNotchIcon className="size-4 animate-spin" />
                                    Refining…
                                  </>
                                ) : (
                                  "Refine"
                                )}
                              </Button>
                              <div className="mx-1 h-5 w-px bg-border" />
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Edit notes"
                                onClick={() => setEditingId(note.id)}
                              >
                                <PencilSimpleIcon className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Copy notes"
                                onClick={() => void handleCopy(note)}
                              >
                                <CopyIcon className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Delete note"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setPendingDelete(note)}
                              >
                                <TrashIcon className="size-4" />
                              </Button>
                            </div>
                          </div>

                          {note.prompt && (
                            <p className="border-t px-4 pt-3 text-xs text-muted-foreground italic">
                              "{note.prompt}"
                            </p>
                          )}
                          <div className="px-4 py-4">
                            <NotesMarkdown content={note.content_md} hideTitle />
                          </div>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </>
      ) : view === "journal" ? (
        <>
          {/* ── Journal composer: full form, or a quick-capture row ── */}
          {journalOpen ? (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">Log this class</p>
                  {logs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close"
                      className="-mt-1 -mr-1 text-muted-foreground"
                      onClick={() => {
                        if (isRecording) stopRecording()
                        setJournalOpen(false)
                      }}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>Class date</Label>
                    <DatePickerField
                      value={logDate}
                      onChange={(d) => {
                        setLogDate(d)
                        periodTouchedRef.current = false
                      }}
                      disableFuture
                      short
                      className="w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Period</Label>
                    <Select
                      value={logPeriodId || "none"}
                      onValueChange={(v) => {
                        periodTouchedRef.current = true
                        setLogPeriodId(v === "none" ? "" : v)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {dayPeriods.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            {p.start_time ? ` · ${p.start_time.slice(0, 5)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="log-text">What happened?</Label>
                  <Textarea
                    id="log-text"
                    placeholder="e.g. Finished photosynthesis diagram, half of respiration left. Gave Q1–5 as homework. Next class I want a quick test on photosynthesis."
                    value={logText}
                    maxLength={5000}
                    rows={3}
                    onChange={(e) => {
                      setLogText(e.target.value)
                      if (!e.target.value.trim()) setVoiceUsed(false)
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {isRecording ? (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <span className="size-2 animate-pulse rounded-full bg-destructive" />
                      Recording · {Math.floor(recordSeconds / 60)}:
                      {String(recordSeconds % 60).padStart(2, "0")}
                    </div>
                  ) : isTranscribing ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <WaveformIcon className="size-4 animate-pulse" />
                      Transcribing your voice note…
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Speak or type — review the text, then log it.
                    </p>
                  )}
                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    {isRecording ? (
                      <Button
                        variant="destructive"
                        className="flex-1 sm:flex-none"
                        onClick={stopRecording}
                        disabled={isTranscribing}
                      >
                        <StopCircleIcon className="size-4" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        onClick={() => void startRecording()}
                        disabled={isTranscribing || isSavingLog}
                        aria-label="Record a voice note"
                      >
                        <MicrophoneIcon className="size-4" />
                        Speak
                      </Button>
                    )}
                    <Button
                      className="flex-1 sm:flex-none"
                      onClick={() => void handleSaveTextLog()}
                      disabled={
                        !logText.trim() ||
                        isSavingLog ||
                        isRecording ||
                        isTranscribing
                      }
                    >
                      {isSavingLog ? (
                        <>
                          <CircleNotchIcon className="size-4 animate-spin" />
                          Saving…
                        </>
                      ) : (
                        "Log this class"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setJournalOpen(true)}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-dashed bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PlusIcon className="size-4" />
                </span>
                <span className="truncate font-medium">Log this class</span>
                <span className="hidden truncate text-muted-foreground sm:inline">
                  — what you covered, where you stopped, homework
                </span>
              </button>
              <Button
                variant="outline"
                className="h-auto shrink-0 rounded-xl px-4"
                aria-label="Speak a voice note"
                onClick={() => {
                  setJournalOpen(true)
                  void startRecording()
                }}
              >
                <MicrophoneIcon className="size-4" />
                <span className="hidden sm:inline">Speak</span>
              </Button>
            </div>
          )}

          {/* Spotlight wave for the entry a notification pointed at — same
              ripple language as the leave-approval wave. */}
          <style>{`
            @keyframes journalLogWave {
              0%   { box-shadow: 0 0 0 0 color-mix(in oklch, var(--color-primary) 45%, transparent); background: color-mix(in oklch, var(--color-primary) 12%, transparent); }
              70%  { box-shadow: 0 0 0 16px transparent; }
              100% { box-shadow: 0 0 0 0 transparent; background: var(--color-card); }
            }
            .journal-log-wave { animation: journalLogWave 1s ease-out 3; }
            @media (prefers-reduced-motion: reduce) {
              .journal-log-wave { animation: none; background: color-mix(in oklch, var(--color-primary) 10%, transparent); }
            }
          `}</style>

          {/* ── Timeline, grouped by day ── */}
          {loadError ? (
            <ErrorState
              title="Couldn't load the class journal"
              error={loadError}
              onRetry={() => classSubjectId && void fetchAll(classSubjectId)}
            />
          ) : isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed py-12 text-center">
              <MicrophoneIcon className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">No entries yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                After each class, take ten seconds to say what you covered —
                Hint uses it to prepare your next lesson from where you
                stopped, and to remind you before the next period.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {groupLogsByDate(logs).map((group) => (
                <section key={group.date} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 px-1">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {dateHeading(group.date)}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {group.logs.length} {group.logs.length === 1 ? "class" : "classes"}
                    </span>
                  </div>

                  {group.logs.map((log) => {
                    const expanded = expandedLogIds.has(log.id)
                    const long = log.raw_entry.length > 180
                    return (
                      <article
                        key={log.id}
                        id={`journal-log-${log.id}`}
                        className={cn(
                          "rounded-xl border bg-card p-4",
                          waveLogId === log.id && "journal-log-wave"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {log.period_name ? (
                              <Badge variant="secondary">{log.period_name}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Period not set
                              </Badge>
                            )}
                            {log.entry_source === "voice" && (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                <MicrophoneIcon className="size-3" />
                                voice
                              </Badge>
                            )}
                            {log.next_intent && (
                              <Badge
                                variant="secondary"
                                className={cn(
                                  log.next_intent.type === "test"
                                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                    : "bg-primary/10 text-primary"
                                )}
                              >
                                Next: {INTENT_LABEL[log.next_intent.type].toLowerCase()}
                                {log.next_intent.topic ? ` — ${log.next_intent.topic}` : ""}
                              </Badge>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                              {dayjs(log.created_at).format("h:mm A")}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Delete entry"
                              className="-mt-1 -mr-1 text-muted-foreground hover:text-destructive"
                              onClick={() => setPendingLogDelete(log)}
                            >
                              <TrashIcon className="size-4" />
                            </Button>
                          </div>
                        </div>

                        {/* The teacher's own words are the record — shown first. */}
                        <p
                          className={cn(
                            "mt-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                            !expanded && long && "line-clamp-3"
                          )}
                        >
                          {log.raw_entry}
                        </p>
                        {long && (
                          <button
                            type="button"
                            className="mt-1 text-xs text-primary hover:underline"
                            onClick={() =>
                              setExpandedLogIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(log.id)) next.delete(log.id)
                                else next.add(log.id)
                                return next
                              })
                            }
                          >
                            {expanded ? "Show less" : "Show more"}
                          </button>
                        )}

                        {(log.covered.length > 0 || log.stopped_at || log.homework) && (
                          <div className="mt-3 flex flex-col gap-2 border-t pt-3">
                            {log.covered.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">Covered</span>
                                {log.covered.map((t, i) => (
                                  <span
                                    key={i}
                                    className="rounded-full bg-muted px-2 py-0.5 text-xs"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
                              {log.stopped_at && (
                                <span className="flex items-start gap-1.5">
                                  <BookmarkSimpleIcon className="mt-0.5 size-3.5 shrink-0" />
                                  <span>
                                    Stopped at{" "}
                                    <span className="text-foreground">{log.stopped_at}</span>
                                  </span>
                                </span>
                              )}
                              {log.homework && (
                                <span className="flex items-start gap-1.5">
                                  <HouseIcon className="mt-0.5 size-3.5 shrink-0" />
                                  <span>
                                    Homework{" "}
                                    <span className="text-foreground">{log.homework}</span>
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        classSubjectId && <SyllabusView classSubjectId={classSubjectId} />
      )}
      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete these notes?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title}" will be removed for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) void handleDelete(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingLogDelete}
        onOpenChange={(open) => !open && setPendingLogDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              The journal entry from{" "}
              {pendingLogDelete
                ? dayjs(pendingLogDelete.date).format("D MMM")
                : ""}{" "}
              will be removed, and Hint will no longer use it to prepare your
              next lesson.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingLogDelete) void handleDeleteLog(pendingLogDelete)
                setPendingLogDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
