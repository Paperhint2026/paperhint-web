import { useEffect, useMemo, useState } from "react"
import {
  BooksIcon,
  ChalkboardIcon,
  CheckIcon,
  CircleNotchIcon,
  FileTextIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { countSummary } from "@/lib/format"
import { timeAgo } from "@/lib/time"
import {
  classLabel,
  useTeacherAssignments,
  type Assignment,
} from "@/hooks/use-teacher-assignments"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { PageToolbar } from "@/components/shared/page-toolbar"
import {
  FilterChip,
  FilterChipGroup,
  MultiSelectField,
} from "@/components/shared/filter-controls"
import { Sticker } from "@/components/shared/sticker"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  MaterialGroup,
  MaterialList,
  MaterialListSkeleton,
  MaterialRowSkeletonRight,
  MaterialRow,
} from "@/modules/knowledge/components/material-list"

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

  // Distinct subjects/grades across the current page, used to seed filters.
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
      ).sort((a, b) => Number(a) - Number(b)),
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

  // Group under the class each material was shared from.
  const grouped = useMemo(() => {
    const groups = new Map<string, BankMaterial[]>()
    for (const m of materials) {
      const key = m.primary_class_label ?? "Other"
      groups.set(key, [...(groups.get(key) ?? []), m])
    }
    return [...groups.entries()].sort(([a], [b]) =>
      a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)
    )
  }, [materials])

  const activeCount = (gradeFilter ? 1 : 0) + (subjectFilter ? 1 : 0)
  const filtering = activeCount > 0 || debouncedSearch.length > 0
  const clearAll = () => {
    setGradeFilter(null)
    setSubjectFilter(null)
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
        icon={BooksIcon}
        title="Shared Library"
        description="Materials teachers across the school have published. Pick any into your own class."
      >
        <PageToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by title or tag…",
          }}
          summary={
            isLoading
              ? undefined
              : countSummary(materials.length, total, "material", filtering)
          }
          filters={
            availableGrades.length > 0 || availableSubjects.length > 0
              ? {
                  activeCount,
                  onClearAll: clearAll,
                  resultLabel: `${materials.length} of ${total} materials`,
                  children: (
                    <>
                      {availableGrades.length > 0 && (
                        <MultiSelectField
                          icon={ChalkboardIcon}
                          label="Grade"
                          placeholder="Any grade"
                          options={availableGrades.map((g) => ({
                            value: g,
                            label: `Grade ${g}`,
                          }))}
                          selected={gradeFilter ? [gradeFilter] : []}
                          onToggle={(v) =>
                            setGradeFilter((cur) => (cur === v ? null : v))
                          }
                          onClear={() => setGradeFilter(null)}
                        />
                      )}
                      {availableSubjects.length > 0 && (
                        <MultiSelectField
                          icon={BooksIcon}
                          label="Subject"
                          placeholder="Any subject"
                          options={availableSubjects.map((s) => ({
                            value: s,
                            label: s,
                          }))}
                          selected={subjectFilter ? [subjectFilter] : []}
                          onToggle={(v) =>
                            setSubjectFilter((cur) => (cur === v ? null : v))
                          }
                          onClear={() => setSubjectFilter(null)}
                          searchable={availableSubjects.length > 8}
                        />
                      )}
                    </>
                  ),
                }
              : undefined
          }
          chips={
            <>
              {gradeFilter && (
                <FilterChipGroup icon={ChalkboardIcon} label="Grade">
                  <FilterChip
                    label={`Grade ${gradeFilter}`}
                    onRemove={() => setGradeFilter(null)}
                  />
                </FilterChipGroup>
              )}
              {subjectFilter && (
                <FilterChipGroup icon={BooksIcon} label="Subject">
                  <FilterChip
                    label={subjectFilter}
                    onRemove={() => setSubjectFilter(null)}
                  />
                </FilterChipGroup>
              )}
            </>
          }
        />
      </PageHeader>

      <LoadingSwap
        loading={isLoading}
        skeleton={
          <MaterialListSkeleton
            right={
              <MaterialRowSkeletonRight status={false} avatar action="button" />
            }
          />
        }
        className="flex-1"
      >
        {materials.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker
              name={filtering ? "lost" : "friends"}
              size={filtering ? 120 : 200}
            />
            <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                {filtering ? "Nothing matches that" : "Nothing shared yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {filtering
                  ? "Try a different word, or drop a filter."
                  : "When teachers publish a material to the school, it shows up here for everyone to pick from."}
              </p>
            </div>
            {filtering && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("")
                  clearAll()
                }}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <MaterialList
            meta={
              <>
                <span className="tabular-nums">
                  {materials.length} of {total}{" "}
                  {total === 1 ? "material" : "materials"}
                </span>
                <span className="ml-auto">Newest first</span>
              </>
            }
          >
            {grouped.map(([label, items]) => (
              <MaterialGroup
                key={label}
                icon={ChalkboardIcon}
                label={label}
                count={items.length}
              >
                {items.map((m) => (
                  <BankRow
                    key={m.id}
                    material={m}
                    picking={pickingId === m.id}
                    onPick={handlePick}
                    myAssignments={assignments ?? []}
                  />
                ))}
              </MaterialGroup>
            ))}
          </MaterialList>
        )}
      </LoadingSwap>
    </div>
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
    <MaterialRow
      icon={FileTextIcon}
      iconTitle="PDF"
      title={material.title}
      subtitle={material.tags.join(", ") || undefined}
      right={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="size-5">
                {material.uploader?.profile_url ? (
                  <AvatarImage
                    src={material.uploader.profile_url}
                    alt={uploaderName}
                  />
                ) : null}
                <AvatarFallback className="text-[8px]">
                  {initials(uploaderName)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{uploaderName}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="w-14 text-right tabular-nums">
                {timeAgo(material.uploaded_at)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {dayjs(material.uploaded_at).format("D MMM YYYY")}
            </TooltipContent>
          </Tooltip>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "h-8 w-32 gap-1.5 text-xs",
                  linkedCount > 0 && "text-muted-foreground"
                )}
                disabled={picking}
              >
                {picking ? (
                  <CircleNotchIcon className="size-3.5 animate-spin" />
                ) : linkedCount > 0 ? (
                  <>
                    <CheckIcon className="size-3.5 text-primary" />
                    Used in {linkedCount}
                  </>
                ) : (
                  <>
                    <PlusIcon className="size-3.5" />
                    Use in my class
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 gap-0 p-1">
              {remainingClasses.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Already used in every class you teach.
                </p>
              ) : (
                <div className="flex flex-col">
                  <p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                    Use in
                  </p>
                  {remainingClasses.map((a) => (
                    <button
                      key={a.class_subject_id}
                      type="button"
                      onClick={() => {
                        setPickerOpen(false)
                        onPick(material, a.class_subject_id)
                      }}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <ChalkboardIcon className="size-3.5 text-muted-foreground" />
                      {classLabel(a)}
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </>
      }
    />
  )
}
