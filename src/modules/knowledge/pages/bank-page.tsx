import { useEffect, useMemo, useState } from "react"
import {
  CheckIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import {
  classLabel,
  useTeacherAssignments,
  type Assignment,
} from "@/hooks/use-teacher-assignments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Uploader {
  id: string
  full_name: string
  email: string
  profile_url?: string
}

interface BankMaterial {
  id: string
  title: string
  tags: string[]
  uploaded_at: string
  primary_class_label: string | null
  primary_grade: number | string | null
  primary_subject_name: string | null
  uploader: Uploader | null
  linked_class_subject_ids: string[]
}

interface BankResponse {
  materials: BankMaterial[]
  total: number
  limit: number
  offset: number
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function BankPage() {
  const { assignments } = useTeacherAssignments()

  const [materials, setMaterials] = useState<BankMaterial[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Debounced search: the user's keystrokes update `search` immediately, but
  // we only refetch when they've paused for 250ms — otherwise every letter
  // fires a request and the results flicker.
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search])

  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)
  const [gradeFilter, setGradeFilter] = useState<string | null>(null)

  const [pickingId, setPickingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set("q", debouncedSearch)
    if (subjectFilter)   params.set("subject", subjectFilter)
    if (gradeFilter)     params.set("grade", gradeFilter)
    apiClient
      .get<BankResponse>(`/api/knowledge/bank${params.toString() ? `?${params}` : ""}`)
      .then((res) => {
        if (cancelled) return
        setMaterials(res.materials ?? [])
        setTotal(res.total ?? 0)
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(err instanceof Error ? err.message : "Failed to load bank")
        setMaterials([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, subjectFilter, gradeFilter])

  // Distinct subjects/grades across the current page, used to seed filter chips.
  const availableSubjects = useMemo(
    () =>
      Array.from(
        new Set(materials.map((m) => m.primary_subject_name).filter(Boolean) as string[]),
      ).sort(),
    [materials],
  )
  const availableGrades = useMemo(
    () =>
      Array.from(
        new Set(materials.map((m) => (m.primary_grade == null ? null : String(m.primary_grade))).filter(Boolean) as string[]),
      ).sort(),
    [materials],
  )

  const handlePick = async (
    material: BankMaterial,
    classSubjectId: string,
  ) => {
    setPickingId(material.id)
    try {
      const res = await apiClient.post<{ coverage_warning?: string | null }>(
        `/api/knowledge/material/${material.id}/pick`,
        { class_subject_id: classSubjectId },
      )
      // Mark it locally so the button flips to "Added" without a refetch.
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === material.id
            ? {
                ...m,
                linked_class_subject_ids: Array.from(
                  new Set([...m.linked_class_subject_ids, classSubjectId]),
                ),
              }
            : m,
        ),
      )
      if (res?.coverage_warning) toast.warning(res.coverage_warning)
      else toast.success("Added to your class")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add material")
    } finally {
      setPickingId(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-secondary-foreground">
            Shared Library
          </h1>
          <p className="text-sm text-muted-foreground">
            Public materials from teachers across your school. Pick one into any
            class you teach.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or tag…"
            className="h-9 w-full rounded-full pl-9 text-sm"
          />
        </div>
      </div>

      {(availableSubjects.length > 0 || availableGrades.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <FiltersPopover
            gradeFilter={gradeFilter}
            subjectFilter={subjectFilter}
            availableGrades={availableGrades}
            availableSubjects={availableSubjects}
            onApply={(g, s) => {
              setGradeFilter(g)
              setSubjectFilter(s)
            }}
          />

          {gradeFilter && (
            <ActivePill
              label={`Grade ${gradeFilter}`}
              onClear={() => setGradeFilter(null)}
            />
          )}
          {subjectFilter && (
            <ActivePill
              label={subjectFilter}
              onClear={() => setSubjectFilter(null)}
            />
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
          <UsersRoundIcon className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No public materials match your search.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Showing {materials.length} of {total}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {materials.map((m) => (
              <BankCard
                key={m.id}
                material={m}
                picking={pickingId === m.id}
                onPick={handlePick}
                myAssignments={assignments ?? []}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FiltersPopover({
  gradeFilter,
  subjectFilter,
  availableGrades,
  availableSubjects,
  onApply,
}: {
  gradeFilter: string | null
  subjectFilter: string | null
  availableGrades: string[]
  availableSubjects: string[]
  onApply: (grade: string | null, subject: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  // Local draft state so the user can dial in Grade + Subject before
  // committing — avoids a refetch on every dropdown change.
  const [draftGrade,   setDraftGrade]   = useState<string | null>(gradeFilter)
  const [draftSubject, setDraftSubject] = useState<string | null>(subjectFilter)

  useEffect(() => {
    if (open) {
      setDraftGrade(gradeFilter)
      setDraftSubject(subjectFilter)
    }
  }, [open, gradeFilter, subjectFilter])

  const activeCount = (gradeFilter ? 1 : 0) + (subjectFilter ? 1 : 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-full text-xs"
        >
          <SlidersHorizontalIcon className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="flex flex-col gap-3">
          {availableGrades.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Class
              </label>
              <Select
                value={draftGrade ?? "__all"}
                onValueChange={(v) => setDraftGrade(v === "__all" ? null : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All classes</SelectItem>
                  {availableGrades.map((g) => (
                    <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {availableSubjects.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Subject
              </label>
              <Select
                value={draftSubject ?? "__all"}
                onValueChange={(v) => setDraftSubject(v === "__all" ? null : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All subjects</SelectItem>
                  {availableSubjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="mt-1 flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 rounded-full text-xs"
              onClick={() => {
                setDraftGrade(null)
                setDraftSubject(null)
                onApply(null, null)
                setOpen(false)
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => {
                onApply(draftGrade, draftSubject)
                setOpen(false)
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ActivePill({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sidebar-accent px-2.5 py-1 text-xs font-medium text-sidebar-foreground">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-foreground/10"
        aria-label={`Clear ${label}`}
      >
        <XIcon className="size-3" />
      </button>
    </span>
  )
}

function BankCard({
  material,
  picking,
  onPick,
  myAssignments,
}: {
  material: BankMaterial
  picking: boolean
  onPick: (m: BankMaterial, classSubjectId: string) => void
  myAssignments: Assignment[]
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const linkedCount = material.linked_class_subject_ids.length
  const remainingClasses = myAssignments.filter(
    (a) => !material.linked_class_subject_ids.includes(a.class_subject_id),
  )
  const uploaderName = material.uploader?.full_name ?? "Unknown"

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug">
          {material.title}
        </p>
        {material.primary_class_label && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {material.primary_class_label}
          </span>
        )}
      </div>

      {material.tags && material.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {material.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
          {material.tags.length > 4 && (
            <span className="text-[10px] text-muted-foreground/60">
              +{material.tags.length - 4} more
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar size="sm">
            {material.uploader?.profile_url ? (
              <AvatarImage src={material.uploader.profile_url} alt={uploaderName} />
            ) : null}
            <AvatarFallback>{initials(uploaderName)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-xs text-muted-foreground">
            {uploaderName}
          </span>
        </div>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={linkedCount > 0 ? "outline" : "default"}
              className="h-7 gap-1 rounded-full text-xs"
              disabled={picking}
            >
              {picking ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : linkedCount > 0 ? (
                <>
                  <CheckIcon className="size-3" />
                  Added to {linkedCount}
                </>
              ) : (
                <>
                  <PlusIcon className="size-3" />
                  Add to class
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-2">
            {remainingClasses.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                Already added to every class you teach.
              </p>
            ) : (
              <div className="flex flex-col">
                <p className="p-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Add to
                </p>
                {remainingClasses.map((a) => (
                  <button
                    key={a.class_subject_id}
                    type="button"
                    onClick={() => {
                      setPickerOpen(false)
                      onPick(material, a.class_subject_id)
                    }}
                    className="rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    {classLabel(a)}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
