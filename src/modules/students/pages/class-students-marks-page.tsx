import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowUpDownIcon,
  CheckCircle2Icon,
  SearchIcon,
  Users2Icon,
} from "lucide-react"
import dayjs from "dayjs"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

interface ExamCol {
  id: string
  exam_name: string
  total_marks: number
  created_at: string
}

interface StudentRow {
  id: string
  full_name: string
  roll_number: number
  register_number?: string | null
}

interface MarkCell {
  final: number | null
  ai: number | null
  status: string
}

interface MatrixResponse {
  exams: ExamCol[]
  students: StudentRow[]
  marks: Record<string, Record<string, MarkCell>>
}

type SortKey = "roll" | "name"

export function ClassStudentsMarksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()

  const [isLoading, setIsLoading] = useState(false)
  const [exams, setExams] = useState<ExamCol[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [marks, setMarks] = useState<Record<string, Record<string, MarkCell>>>({})
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("roll")
  const [sortAsc, setSortAsc] = useState(true)

  const fetchMatrix = useCallback(async (csId: string) => {
    setIsLoading(true)
    try {
      const res = await apiClient.get<MatrixResponse>(
        `/api/grading/class-subject/${csId}/marks-matrix`,
      )
      setExams(res.exams ?? [])
      setStudents(res.students ?? [])
      setMarks(res.marks ?? {})
    } catch {
      setExams([])
      setStudents([])
      setMarks({})
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (classSubjectId) fetchMatrix(classSubjectId)
  }, [classSubjectId, fetchMatrix])

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? students.filter(
          (s) =>
            s.full_name.toLowerCase().includes(q) ||
            String(s.roll_number).includes(q) ||
            (s.register_number ?? "").toLowerCase().includes(q),
        )
      : students.slice()

    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.full_name.localeCompare(b.full_name)
      else cmp = a.roll_number - b.roll_number
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [students, search, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  if (!user) return null

  if (!classSubjectId) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 p-8">
        <Users2Icon className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Select a class from the sidebar</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b px-5 py-3">
        <h1 className="shrink-0 text-sm font-semibold">Students</h1>
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, roll no, register no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {students.length} student{students.length !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span>
            {exams.length} exam{exams.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Users2Icon className="size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No students in this class yet
            </p>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              {/* Single uniform header row: Roll · Name · per-exam columns. */}
              <tr className="bg-muted/40 [&>th]:h-14">
                <th className="sticky left-0 top-0 z-30 w-24 border-b bg-muted/40 px-3 align-middle text-left text-[11px] font-medium text-muted-foreground">
                  <button
                    onClick={() => toggleSort("roll")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Roll
                    <ArrowUpDownIcon
                      className={cn(
                        "size-3",
                        sortKey === "roll" ? "text-foreground" : "opacity-40",
                      )}
                    />
                  </button>
                </th>
                <th className="sticky left-24 top-0 z-30 min-w-[200px] border-b border-r bg-muted/40 px-3 align-middle text-left text-[11px] font-medium text-muted-foreground">
                  <button
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Name
                    <ArrowUpDownIcon
                      className={cn(
                        "size-3",
                        sortKey === "name" ? "text-foreground" : "opacity-40",
                      )}
                    />
                  </button>
                </th>
                {exams.map((ex, idx) => (
                  <th
                    key={ex.id}
                    className={cn(
                      "sticky top-0 z-20 min-w-[160px] border-b bg-muted/40 px-3 align-middle text-left text-[11px] font-medium",
                      idx === 0 && "border-l",
                    )}
                  >
                    <button
                      onClick={() =>
                        navigate(`/class/${classSubjectId}/exams?exam=${ex.id}`)
                      }
                      className="block w-full text-left transition-colors hover:text-primary"
                      title={ex.exam_name}
                    >
                      <span className="line-clamp-1 text-foreground">{ex.exam_name}</span>
                      <span className="text-[9px] font-normal text-muted-foreground">
                        {dayjs(ex.created_at).format("MMM D")} · {ex.total_marks} marks
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredSorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + exams.length}
                    className="px-3 py-10 text-center text-xs text-muted-foreground"
                  >
                    No students match your search.
                  </td>
                </tr>
              ) : (
                filteredSorted.map((s) => {
                  return (
                    <tr
                      key={s.id}
                      className="group transition-colors hover:bg-muted/30"
                    >
                      <td className="sticky left-0 z-10 w-24 border-b bg-background px-3 py-2 align-middle text-xs font-semibold tabular-nums group-hover:bg-muted/30">
                        {s.roll_number}
                      </td>
                      <td className="sticky left-24 z-10 min-w-[200px] border-b border-r bg-background px-3 py-2 align-middle text-xs group-hover:bg-muted/30">
                        <p className="font-medium text-foreground">{s.full_name}</p>
                        {s.register_number && (
                          <p className="text-[10px] text-muted-foreground">
                            Reg: {s.register_number}
                          </p>
                        )}
                      </td>

                      {exams.map((ex, exIdx) => {
                        const cell = marks[s.id]?.[ex.id]
                        return (
                          <td
                            key={ex.id}
                            className={cn(
                              "border-b px-3 py-2 align-middle text-xs tabular-nums",
                              exIdx === 0 && "border-l",
                            )}
                          >
                            {!cell ? (
                              <span className="text-muted-foreground/40">—</span>
                            ) : cell.status === "graded" ? (
                              <MarkCellView
                                obtained={cell.final ?? 0}
                                total={ex.total_marks}
                              />
                            ) : (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  cell.status === "uploaded" || cell.status === "processing"
                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                                )}
                              >
                                {cell.status === "uploaded" || cell.status === "processing"
                                  ? "Pending"
                                  : cell.status}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function MarkCellView({ obtained, total }: { obtained: number; total: number }) {
  const pct = total > 0 ? (obtained / total) * 100 : 0
  const color =
    pct >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 50
        ? "text-foreground"
        : "text-amber-600 dark:text-amber-400"
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold", color)}>
      {pct >= 80 && <CheckCircle2Icon className="size-3" />}
      {obtained}
      <span className="font-normal text-muted-foreground">/{total}</span>
    </span>
  )
}
