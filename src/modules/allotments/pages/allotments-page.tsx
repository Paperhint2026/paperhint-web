import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChalkboardTeacherIcon,
  CircleNotchIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { showError } from "@/lib/show-error"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"

/**
 * Classes › Allotments (module 03). One school-wide staffing board: sections ×
 * subjects, the teacher(s) allotted in each cell, gaps visible, and a tiered
 * picker — allotted, then the department that owns the subject, then everyone.
 * A grade decides the subject; a section decides who teaches it.
 */

type TeacherLite = { id: string; full_name: string }
type BoardSubject = {
  class_subject_id: string
  subject_id: string | null
  subject_name: string
  subject_type: string
  elective_group_name: string | null
  teachers: TeacherLite[]
}
type BoardSection = {
  class_id: string
  section: string
  academic_year: string
  class_teacher_id: string | null
  class_teacher_name: string | null
  subjects: BoardSubject[]
}
type Board = {
  grades: { grade: number; sections: BoardSection[] }[]
  gaps: number
  load: Record<string, { slots: number; allotments: number }>
}
type Candidate = {
  id: string
  full_name: string
  designation: string | null
  tier: 1 | 2 | 3 | 4
  load: { slots: number; allotments: number }
}
const TIER_LABEL: Record<number, string> = {
  1: "Allotted",
  2: "Can teach it",
  3: "In the owning department",
  4: "Everyone else",
}

export function AllotmentsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState("")
  const [grade, setGrade] = useState<number | "all">("all")
  const [gapsOnly, setGapsOnly] = useState(false)

  const load = useCallback(() => {
    apiClient
      .get<Board>("/api/teacher-assignments/board")
      .then(setBoard)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load the board")
      )
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const grades = useMemo(() => board?.grades.map((g) => g.grade) ?? [], [board])
  const visible = useMemo(() => {
    if (!board) return []
    return board.grades
      .filter((g) => grade === "all" || g.grade === grade)
      .map((g) => ({
        ...g,
        sections: g.sections
          .map((s) => ({
            ...s,
            subjects: gapsOnly
              ? s.subjects.filter((x) => x.teachers.length === 0)
              : s.subjects,
          }))
          .filter((s) => !gapsOnly || s.subjects.length > 0),
      }))
      .filter((g) => g.sections.length > 0)
  }, [board, grade, gapsOnly])

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <PageHeader
        icon={ChalkboardTeacherIcon}
        title="Allotments"
        description="Who teaches which subject in which section. Gaps show here first."
      >
        {board && (
          <Badge
            variant={board.gaps > 0 ? "destructive" : "secondary"}
            className="rounded-full"
          >
            {board.gaps === 0
              ? "No gaps"
              : `${board.gaps} ${board.gaps === 1 ? "gap" : "gaps"}`}
          </Badge>
        )}
      </PageHeader>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Sticker name="worried" size={88} />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={load}>
            Try again
          </Button>
        </div>
      ) : !board ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : board.grades.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Sticker name="point" size={96} />
          <p className="text-base font-medium text-secondary-foreground">
            No classes yet
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add grades and sections under Classes, then allot teachers here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              <FilterChip
                active={grade === "all"}
                onClick={() => setGrade("all")}
              >
                All grades
              </FilterChip>
              {grades.map((g) => (
                <FilterChip
                  key={g}
                  active={grade === g}
                  onClick={() => setGrade(g)}
                >
                  Grade {g}
                </FilterChip>
              ))}
            </div>
            <FilterChip
              active={gapsOnly}
              onClick={() => setGapsOnly((v) => !v)}
              className="ml-auto"
            >
              Gaps only
            </FilterChip>
          </div>

          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing to show for this filter.
            </p>
          ) : (
            visible.map((g) => (
              <section key={g.grade} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Grade {g.grade}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="w-40 px-3 py-2 font-medium">Section</th>
                        <th className="px-3 py-2 font-medium">
                          Subjects and who teaches them
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {g.sections.map((s) => (
                        <tr key={s.class_id} className="align-top">
                          <td className="px-3 py-3 font-medium text-foreground">
                            <div className="flex flex-col gap-1">
                              <span>{s.section}</span>
                              <ClassTeacherPicker
                                section={s}
                                canEdit={isAdmin}
                                onChanged={load}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              {s.subjects.map((sub) => (
                                <Cell
                                  key={sub.class_subject_id}
                                  subject={sub}
                                  load={board.load}
                                  canEdit={isAdmin}
                                  onChanged={load}
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  )
}

function Cell({
  subject,
  load,
  canEdit,
  onChanged,
}: {
  subject: BoardSubject
  load: Board["load"]
  canEdit: boolean
  onChanged: () => void
}) {
  const gap = subject.teachers.length === 0
  const [open, setOpen] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCandidates(null)
    apiClient
      .get<{ candidates: Candidate[] }>(
        `/api/teacher-assignments/candidates?class_subject_id=${subject.class_subject_id}`
      )
      .then((r) => setCandidates(r.candidates))
      .catch((e) => showError(e, "Could not load teachers"))
  }, [open, subject.class_subject_id])

  const assign = async (t: Candidate) => {
    setBusy(t.id)
    try {
      await apiClient.post("/api/teacher-assignments", {
        teacher_id: t.id,
        class_subject_id: subject.class_subject_id,
      })
      toast.success(`${t.full_name} allotted to ${subject.subject_name}`)
      setOpen(false)
      onChanged()
    } catch (e) {
      showError(e)
    } finally {
      setBusy(null)
    }
  }
  const unassign = async (t: TeacherLite) => {
    setBusy(t.id)
    try {
      await apiClient.post("/api/teacher-assignments/unassign", {
        teacher_id: t.id,
        class_subject_id: subject.class_subject_id,
      })
      toast.success(`${t.full_name} released from ${subject.subject_name}`)
      onChanged()
    } catch (e) {
      showError(e)
    } finally {
      setBusy(null)
    }
  }

  const filtered = (candidates ?? []).filter((c) =>
    c.full_name.toLowerCase().includes(query.toLowerCase())
  )
  const tiers = [1, 2, 3, 4]
    .map((t) => ({ tier: t, rows: filtered.filter((c) => c.tier === t) }))
    .filter((g) => g.rows.length > 0)

  return (
    <div
      className={cn(
        "flex min-w-40 flex-col gap-1 rounded-lg border px-2.5 py-2",
        gap
          ? "border-dashed border-destructive/50 bg-destructive/5"
          : "border-border bg-background"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-foreground">
          {subject.subject_name}
          {subject.subject_type === "elective" && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              elective
            </span>
          )}
        </span>
        {canEdit && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Allot a teacher to ${subject.subject_name}`}
                className="grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b border-border p-2">
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a teacher"
                  className="h-8 text-sm"
                />
              </div>
              <div className="max-h-72 overflow-y-auto p-1">
                {candidates === null ? (
                  <div className="p-3">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : tiers.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    No one matches.
                  </p>
                ) : (
                  tiers.map((g) => (
                    <div key={g.tier} className="mb-1">
                      <div className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        {TIER_LABEL[g.tier]}
                      </div>
                      {g.rows.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={c.tier === 1 || busy === c.id}
                          onClick={() => assign(c)}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-60"
                        >
                          <span className="truncate">
                            {c.full_name}
                            {c.designation && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                · {c.designation}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                            {busy === c.id ? (
                              <CircleNotchIcon className="size-3.5 animate-spin" />
                            ) : (
                              `${c.load.allotments} allot · ${c.load.slots} slots`
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {gap ? (
          <span className="text-[11px] text-destructive">No teacher</span>
        ) : (
          subject.teachers.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground"
            >
              {t.full_name}
              <span className="text-muted-foreground">
                · {load[t.id]?.slots ?? 0}p
              </span>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Release ${t.full_name}`}
                  onClick={() => unassign(t)}
                  disabled={busy === t.id}
                  className="ml-0.5 grid size-3.5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
                >
                  <XIcon className="size-2.5" />
                </button>
              )}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

/* ── Class teacher ──────────────────────────────────────────────────────────
   One per section, chosen here on the board. Owns the section: takes the
   day roll in per-day attendance, sees the class's full day in per-period
   mode; later student-update privileges hang off it. */

let teacherListCache: TeacherLite[] | null = null

function ClassTeacherPicker({
  section,
  canEdit,
  onChanged,
}: {
  section: BoardSection
  canEdit: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [teachers, setTeachers] = useState<TeacherLite[] | null>(teacherListCache)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || teachers) return
    apiClient
      .get<{ teachers: TeacherLite[] }>("/api/auth/teachers")
      .then((r) => {
        teacherListCache = r.teachers ?? []
        setTeachers(teacherListCache)
      })
      .catch(() => setTeachers([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = async (teacher_id: string | null) => {
    setBusy(true)
    try {
      await apiClient.put("/api/teacher-assignments/class-teacher", {
        class_id: section.class_id,
        teacher_id,
      })
      toast.success(teacher_id ? "Class teacher set" : "Class teacher cleared")
      setOpen(false)
      onChanged()
    } catch (e) {
      showError(e, "Could not set the class teacher")
    } finally {
      setBusy(false)
    }
  }

  if (!canEdit) {
    return section.class_teacher_name ? (
      <span className="text-[11px] font-normal whitespace-nowrap text-muted-foreground">
        CT: {section.class_teacher_name}
      </span>
    ) : null
  }

  const filtered = (teachers ?? []).filter((t) =>
    t.full_name.toLowerCase().includes(query.toLowerCase())
  )
  // Teachers already teaching this section lead the list — the class teacher
  // is almost always one of them.
  const sectionTeacherIds = new Set(
    section.subjects.flatMap((sub) => sub.teachers.map((t) => t.id))
  )
  const teachesHere = filtered.filter((t) => sectionTeacherIds.has(t.id))
  const others = filtered.filter((t) => !sectionTeacherIds.has(t.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={
            section.class_teacher_name
              ? `Class teacher: ${section.class_teacher_name} — change`
              : "Choose the class teacher"
          }
          className={cn(
            "self-start rounded-md border border-dashed px-1.5 py-0.5 text-[11px] font-normal whitespace-nowrap transition-colors",
            section.class_teacher_name
              ? "border-transparent bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {section.class_teacher_name ? (
            <>
              CT:{" "}
              <span className="inline-block max-w-28 truncate align-bottom">
                {section.class_teacher_name}
              </span>
            </>
          ) : (
            "+ Class teacher"
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          autoFocus
          placeholder="Find a teacher…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 h-8 text-xs"
        />
        <div className="max-h-56 overflow-y-auto">
          {teachers === null ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</p>
          ) : (
            <>
              {teachesHere.length > 0 && (
                <p className="px-2 pt-1 pb-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Teaches this class
                </p>
              )}
              {teachesHere.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => set(t.id)}
                  className={cn(
                    "block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                    t.id === section.class_teacher_id && "font-medium text-primary"
                  )}
                >
                  {t.full_name}
                </button>
              ))}
              {teachesHere.length > 0 && others.length > 0 && (
                <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Everyone else
                </p>
              )}
              {others.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => set(t.id)}
                  className={cn(
                    "block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                    t.id === section.class_teacher_id && "font-medium text-primary"
                  )}
                >
                  {t.full_name}
                </button>
              ))}
            </>
          )}
        </div>
        {section.class_teacher_id && (
          <button
            type="button"
            disabled={busy}
            onClick={() => set(null)}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
          >
            Clear class teacher
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

