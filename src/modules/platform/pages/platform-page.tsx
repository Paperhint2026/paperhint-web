import { useCallback, useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { BuildingsIcon, PlusIcon } from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// ─────────────────────────────────────────────────────────────────────────────
// Platform Console — PaperHint team only (users.role === 'platform').
// School provisioning + per-school module licensing. The API double-checks
// the role on every request; this guard is just the door.
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  timetable: "Timetable",
  calendar: "Academic calendar",
  copilot: "Ask Hint (copilot)",
  grading: "AI grading",
}

interface SchoolRow {
  id: string
  name: string
  board: { id: string; name: string } | null
  active_academic_year: string | null
  created_at: string
  admins: number
  teachers: number
  classes: number
  features: Record<string, boolean>
  plan_name: string | null
  valid_until: string | null
}

export function PlatformPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [schools, setSchools] = useState<SchoolRow[] | null>(null)
  const [gateable, setGateable] = useState<string[]>([])
  const [error, setError] = useState("")

  const fetchSchools = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        schools: SchoolRow[]
        gateable_modules: string[]
      }>("/api/platform/schools")
      setSchools(res.schools ?? [])
      setGateable(res.gateable_modules ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    }
  }, [])

  useEffect(() => {
    if (user?.role === "platform") fetchSchools()
  }, [user?.role, fetchSchools])

  // Hard door: anyone who isn't the PaperHint team never sees this tree.
  if (user && user.role !== "platform") return <Navigate to="/" replace />

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <PageHeader
        icon={BuildingsIcon}
        title="Platform Console"
        description="PaperHint internal — school provisioning and module licensing."
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {schools
            ? `${schools.length} school${schools.length === 1 ? "" : "s"}`
            : ""}
        </p>
        <Button
          size="sm"
          className="rounded-full"
          onClick={() => navigate("/platform/schools/new")}
        >
          <PlusIcon className="size-3.5" />
          New school
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : schools === null ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse bg-background text-sm">
            <thead>
              <tr className="bg-sidebar text-xs">
                <th className="border-b border-border px-4 py-2.5 text-left font-medium text-muted-foreground">
                  School
                </th>
                <th className="border-b border-border px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Board
                </th>
                <th className="border-b border-border px-3 py-2.5 text-center font-medium text-muted-foreground">
                  Admins
                </th>
                <th className="border-b border-border px-3 py-2.5 text-center font-medium text-muted-foreground">
                  Teachers
                </th>
                <th className="border-b border-border px-3 py-2.5 text-center font-medium text-muted-foreground">
                  Sections
                </th>
                <th className="border-b border-border px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Plan
                </th>
                <th className="border-b border-border px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Modules
                </th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => {
                const disabled = gateable.filter((m) => s.features[m] === false)
                return (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/platform/schools/${s.id}`)}
                  >
                    <td className="border-b border-border px-4 py-3 font-medium text-foreground">
                      {s.name}
                      {s.active_academic_year && (
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          AY {s.active_academic_year}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-border px-3 py-3 text-muted-foreground">
                      {s.board?.name ?? "—"}
                    </td>
                    <td className="border-b border-border px-3 py-3 text-center tabular-nums">
                      {s.admins}
                    </td>
                    <td className="border-b border-border px-3 py-3 text-center tabular-nums">
                      {s.teachers}
                    </td>
                    <td className="border-b border-border px-3 py-3 text-center tabular-nums">
                      {s.classes}
                    </td>
                    <td className="border-b border-border px-3 py-3 text-muted-foreground">
                      {s.plan_name ?? "—"}
                      {s.valid_until && (
                        <span className="block text-[11px]">
                          until {s.valid_until}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      {disabled.length === 0 ? (
                        <Badge
                          variant="secondary"
                          className="rounded-full text-[10px]"
                        >
                          all modules
                        </Badge>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {disabled.map((m) => (
                            <Badge
                              key={m}
                              variant="outline"
                              className="rounded-full text-[10px] text-destructive"
                            >
                              {MODULE_LABELS[m] ?? m} off
                            </Badge>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {schools.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No schools yet — create the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
