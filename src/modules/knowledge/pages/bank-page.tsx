import { useEffect, useMemo, useState } from "react"
import {
  CheckIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UsersRoundIcon,
} from "lucide-react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import {
  classLabel,
  useTeacherAssignments,
  type Assignment,
} from "@/hooks/use-teacher-assignments"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FilterChip } from "@/components/shared/filter-controls"
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
    if (subjectFilter) params.set("subject", subjectFilter)
    if (gradeFilter) params.set("grade", gradeFilter)
    apiClient
      .get<BankResponse>(
        `/api/knowledge/bank${params.toString() ? `?${params}` : ""}`
      )
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
        new Set(
          materials
            .map((m) => m.primary_subject_name)
            .filter(Boolean) as string[]
        )
      ).sort(),
    [materials]
  )
  const availableGrades = useMemo(
    () =>
      Array.from(
        new Set(
          materials
            .map((m) =>
              m.primary_grade == null ? null : String(m.primary_grade)
            )
            .filter(Boolean) as string[]
        )
      ).sort(),
    [materials]
  )

  const handlePick = async (material: BankMaterial, classSubjectId: string) => {
    setPickingId(material.id)
    try {
      const res = await apiClient.post<{ coverage_warning?: string | null }>(
        `/api/knowledge/material/${material.id}/pick`,
        { class_subject_id: classSubjectId }
      )
      // Mark it locally so the button flips to "Added" without a refetch.
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === material.id
            ? {
                ...m,
                linked_class_subject_ids: Array.from(
                  new Set([...m.linked_class_subject_ids, classSubjectId])
                ),
              }
            : m
        )
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
    <div className="flex h-full w-full flex-col gap-4 p-4 md:p-6">
      {/* Toolbar — search + filter popover + active-filter chips */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials..."
              className="h-9 rounded-full pl-9"
            />
          </div>

          {(availableSubjects.length > 0 || availableGrades.length > 0) && (
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
          )}
        </div>

        {(gradeFilter || subjectFilter) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {gradeFilter && (
              <FilterChip
                label={`Grade ${gradeFilter}`}
                onRemove={() => setGradeFilter(null)}
              />
            )}
            {subjectFilter && (
              <FilterChip
                label={subjectFilter}
                onRemove={() => setSubjectFilter(null)}
              />
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-6" />
        </div>
      ) : materials.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-sidebar p-5">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <UsersRoundIcon className="size-6 text-muted-foreground" />
          </div>
          <div className="flex max-w-[400px] flex-col items-center gap-1 text-center">
            <p className="text-base font-medium text-secondary-foreground">
              No public materials found
            </p>
            <p className="text-sm text-muted-foreground">
              Try a different search, or check back once teachers publish
              materials to the school.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto overscroll-none rounded-lg border [&_[data-slot=table-container]]:overflow-visible">
            <Table className="border-collapse">
              <TableHeader className="sticky top-0 z-20 bg-sidebar shadow-[0_1px_0_0_var(--border)] [&_th]:h-10 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-56">Title</TableHead>
                  <TableHead className="min-w-28">Class</TableHead>
                  <TableHead className="min-w-40">Tags</TableHead>
                  <TableHead className="min-w-28">Uploaded</TableHead>
                  <TableHead className="min-w-40">Shared by</TableHead>
                  <TableHead className="w-36 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => (
                  <BankRow
                    key={m.id}
                    material={m}
                    picking={pickingId === m.id}
                    onPick={handlePick}
                    myAssignments={assignments ?? []}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {materials.length} of {total}
          </p>
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
  // committing — avoids a refetch on every dropdown change. Drafts re-seed
  // from the applied filters each time the popover opens.
  const [draftGrade, setDraftGrade] = useState<string | null>(gradeFilter)
  const [draftSubject, setDraftSubject] = useState<string | null>(subjectFilter)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraftGrade(gradeFilter)
      setDraftSubject(subjectFilter)
    }
    setOpen(next)
  }

  const activeCount = (gradeFilter ? 1 : 0) + (subjectFilter ? 1 : 0)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 rounded-full"
        >
          <SlidersHorizontalIcon className="size-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">Filters</p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setDraftGrade(null)
                setDraftSubject(null)
                onApply(null, null)
                setOpen(false)
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4 p-4">
          {availableGrades.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Class</Label>
              <Select
                value={draftGrade ?? "__all"}
                onValueChange={(v) => setDraftGrade(v === "__all" ? null : v)}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All classes</SelectItem>
                  {availableGrades.map((g) => (
                    <SelectItem key={g} value={g}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {availableSubjects.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <Select
                value={draftSubject ?? "__all"}
                onValueChange={(v) => setDraftSubject(v === "__all" ? null : v)}
              >
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All subjects</SelectItem>
                  {availableSubjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-full text-xs"
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

function BankRow({
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
    (a) => !material.linked_class_subject_ids.includes(a.class_subject_id)
  )
  const uploaderName = material.uploader?.full_name ?? "Unknown"

  return (
    <TableRow>
      <TableCell>
        <span className="block max-w-72 truncate text-sm font-medium text-secondary-foreground">
          {material.title}
        </span>
      </TableCell>
      <TableCell>
        {material.primary_class_label ? (
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
            {material.primary_class_label}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell>
        {material.tags && material.tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {material.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
            {material.tags.length > 2 && (
              <span
                title={material.tags.slice(2).join(", ")}
                className="text-[11px] text-muted-foreground/60"
              >
                +{material.tags.length - 2}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {dayjs(material.uploaded_at).format("MMM D, YYYY")}
      </TableCell>
      <TableCell>
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar className="size-5">
            {material.uploader?.profile_url ? (
              <AvatarImage
                src={material.uploader.profile_url}
                alt={uploaderName}
              />
            ) : null}
            <AvatarFallback className="text-[9px]">
              {initials(uploaderName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-xs text-muted-foreground">
            {uploaderName}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
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
                <p className="p-2 text-[10px] tracking-wide text-muted-foreground uppercase">
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
      </TableCell>
    </TableRow>
  )
}
