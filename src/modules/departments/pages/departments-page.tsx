import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CircleNotchIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { showError } from "@/lib/show-error"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"
import { DepartmentCard } from "@/modules/departments/components/department-card"
import { looksLikeSubject } from "@/modules/departments/lib/subject-words"
import type { Department } from "@/modules/departments/lib/types"

/**
 * Departments as a grid of doors (founder, 2026-09-13): students are grouped
 * into grades, teachers into departments, so this grid and the Classes grid
 * look alike. A card opens the department's own page — cards with their own
 * contents are pages, never drawers.
 */
export function DepartmentsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[] | null>(null)
  const [error, setError] = useState("")
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [subjectNames, setSubjectNames] = useState<string[]>([])
  // Touched once, the tick stops following what is typed.
  const [withSubject, setWithSubject] = useState<boolean | null>(null)

  const load = useCallback(() => {
    Promise.all([
      apiClient.get<{ departments: Department[] }>("/api/departments"),
      apiClient
        .get<{ subjects: { subject_name: string }[] }>("/api/subjects")
        .catch(() => ({ subjects: [] })),
    ])
      .then(([d, s]) => {
        setDepartments(d.departments ?? [])
        setSubjectNames((s.subjects ?? []).map((x) => x.subject_name))
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load departments")
      )
  }, [])
  useEffect(() => {
    load()
  }, [load])

  // On for a name that reads like something taught, off for a place or a house.
  const suggestSubject = withSubject ?? looksLikeSubject(newName, subjectNames)

  const create = async () => {
    setBusy(true)
    try {
      const r = await apiClient.post<{
        department: { id: string }
        subject?: { subject_name: string } | null
      }>("/api/departments", { name: newName.trim() })
      toast.success(
        r.subject
          ? `${newName.trim()} added, with ${r.subject.subject_name} as its subject`
          : `${newName.trim()} added`
      )
      setNewName("")
      setWithSubject(null)
      setAdding(false)
      navigate(`/departments/${r.department.id}`)
    } catch (e) {
      showError(e)
    } finally {
      setBusy(false)
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
      <PageHeader
        icon={UsersThreeIcon}
        title="Departments"
        description="How the school groups its teachers, and which subjects each group owns."
      >
        {isAdmin && departments !== null && (
          /* A bare input under the page title reads as a search box. This is an
             action, so it looks like one and asks for the name once opened. */
          <Popover open={adding} onOpenChange={setAdding}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-fit">
                <PlusIcon className="size-4" />
                New department
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newName.trim()) create()
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-department" className="text-xs">
                    Department name
                  </Label>
                  <Input
                    id="new-department"
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Commerce"
                    className="h-9"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    className="mt-0.5"
                    checked={suggestSubject}
                    onCheckedChange={(v) => setWithSubject(v === true)}
                  />
                  <span>
                    Also create a subject called{" "}
                    <span className="text-foreground">
                      {newName.trim() || "the same name"}
                    </span>
                    <span className="block text-[11px]">
                      A department that teaches several subjects, or none,
                      leaves this off.
                    </span>
                  </span>
                </label>
                <Button type="submit" disabled={!newName.trim() || busy}>
                  {busy ? (
                    <CircleNotchIcon className="size-4 animate-spin" />
                  ) : (
                    <PlusIcon className="size-4" />
                  )}
                  Add department
                </Button>
              </form>
            </PopoverContent>
          </Popover>
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
      ) : departments === null ? (
        <div className="grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Sticker name="point" size={96} />
          <p className="text-base font-medium text-secondary-foreground">
            No departments yet
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add the first one above. Its subject comes with it, and teachers
            join it from their own profile.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
          {departments.map((d, i) => (
            <DepartmentCard
              key={d.id}
              index={i}
              name={d.name}
              teacherCount={d.member_count}
              subjectCount={d.subjects.length}
              headCount={d.heads.length}
              onOpen={() => navigate(`/departments/${d.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
