import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowsClockwiseIcon,
  BookOpenIcon,
  ChalkboardIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  DotsThreeIcon,
  FileIcon,
  FileTextIcon,
  GlobeHemisphereWestIcon,
  ImageIcon,
  LinkSimpleIcon,
  LockSimpleIcon,
  ShareNetworkIcon,
  TrashIcon,
  UploadIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import {
  PageToolbar,
  PageToolbarSkeleton,
} from "@/components/shared/page-toolbar"
import { countSummary } from "@/lib/format"
import { timeAgo } from "@/lib/time"
import { Sticker } from "@/components/shared/sticker"
import { LoadingSwap } from "@/components/shared/loading-swap"
import {
  MaterialGroup,
  MaterialList,
  MaterialListSkeleton,
  MaterialRow,
} from "@/modules/knowledge/components/material-list"
import {
  useTeacherAssignments,
  classLabel,
} from "@/hooks/use-teacher-assignments"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  FilterChip,
  FilterChipGroup,
  MultiSelectField,
} from "@/components/shared/filter-controls"
import { useHeaderActions } from "@/components/layout/header-actions-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ClassSubjectMultiSelect,
  type ClassSubjectOption,
} from "@/modules/knowledge/components/class-subject-multi-select"
import { MaterialLinksDialog } from "@/modules/knowledge/components/material-links-dialog"
import {
  type ClassSubjectLabel,
  formatClassSubjectLabel,
  type Material,
  type TeacherLite,
} from "@/modules/knowledge/lib/types"

function getFileIcon(url: string) {
  const lower = url.toLowerCase()
  if (lower.endsWith(".pdf")) return FileTextIcon
  if (/\.(jpe?g|png|webp|gif|svg)/.test(lower)) return ImageIcon
  return FileIcon
}

/** Short type word for the row's leading slot. */
function fileKind(url: string) {
  const lower = url.toLowerCase()
  if (lower.endsWith(".pdf")) return "PDF"
  if (/\.(jpe?g|png|webp|gif|svg)(?:[?#]|$)/.test(lower)) return "Image"
  return "File"
}

function initials(name?: string | null) {
  if (!name) return "?"
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

interface LibraryResponse {
  materials: Material[]
  class_subjects: ClassSubjectLabel[]
  teachers: TeacherLite[]
  can_edit: boolean
}

export function LibraryPage() {
  const { user } = useAuth()
  const { assignments } = useTeacherAssignments()
  const { setHeaderActions } = useHeaderActions()

  const [materials, setMaterials] = useState<Material[]>([])
  const [csLabels, setCsLabels] = useState<Record<string, ClassSubjectLabel>>(
    {}
  )
  const [teachersMap, setTeachersMap] = useState<Record<string, TeacherLite>>(
    {}
  )
  const [canEdit, setCanEdit] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [filterCsId, setFilterCsId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const [uploadOpen, setUploadOpen] = useState(false)
  const [editLinksFor, setEditLinksFor] = useState<Material | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Material | null>(null)

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const fetchLibrary = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get<LibraryResponse>("/api/knowledge/library")
      setMaterials(res.materials ?? [])
      const cs: Record<string, ClassSubjectLabel> = {}
      for (const c of res.class_subjects ?? []) cs[c.class_subject_id] = c
      setCsLabels(cs)
      const tm: Record<string, TeacherLite> = {}
      for (const t of res.teachers ?? []) tm[t.id] = t
      setTeachersMap(tm)
      setCanEdit(res.can_edit)
    } catch (err) {
      console.error("Failed to fetch library:", err)
      setMaterials([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  const teacherOptionCount = assignments.length

  useEffect(() => {
    if (!canEdit) return
    const upload = (
      <Button
        size="lg"
        onClick={() => setUploadOpen(true)}
        disabled={teacherOptionCount === 0}
      >
        <UploadIcon className="size-3.5" />
        <span className="hidden sm:inline">Upload</span>
      </Button>
    )
    setHeaderActions(
      teacherOptionCount === 0 ? (
        // A disabled button swallows pointer events, so the tooltip hangs
        // off a wrapper that still receives them.
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex rounded-md">
              {upload}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            You need to be assigned to a class-subject first
          </TooltipContent>
        </Tooltip>
      ) : (
        upload
      )
    )
    return () => setHeaderActions(null)
  }, [canEdit, teacherOptionCount, setHeaderActions])

  const teacherOptions = useMemo<ClassSubjectOption[]>(
    () =>
      assignments.map((a) => ({
        class_subject_id: a.class_subject_id,
        label: classLabel(a),
      })),
    [assignments]
  )

  const csLabelFor = useCallback(
    (csId: string) => {
      const fromLabels = csLabels[csId]
      if (fromLabels) return formatClassSubjectLabel(fromLabels)
      const fromAssign = assignments.find((a) => a.class_subject_id === csId)
      return fromAssign ? classLabel(fromAssign) : "Unknown class"
    },
    [csLabels, assignments]
  )

  // Build filter chips from the union of all class-subjects referenced by
  // any material the user can see.
  const filterChips = useMemo(() => {
    const ids = new Set<string>()
    for (const m of materials)
      for (const cs of m.linked_class_subject_ids) ids.add(cs)
    return [...ids]
      .map((id) => ({ id, label: csLabelFor(id) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [materials, csLabelFor])

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (filterCsId && !m.linked_class_subject_ids.includes(filterCsId))
        return false
      if (search) {
        const q = search.toLowerCase()
        const inTitle = m.title.toLowerCase().includes(q)
        const inTags = (m.tags || []).some((t) => t.toLowerCase().includes(q))
        if (!inTitle && !inTags) return false
      }
      return true
    })
  }, [materials, filterCsId, search])

  // Rows grouped under the first class they are linked to; unlinked files
  // gather at the end. Group order follows the class label.
  const groupedMaterials = useMemo(() => {
    const groups = new Map<string, { label: string; items: Material[] }>()
    for (const m of filteredMaterials) {
      const csId = m.linked_class_subject_ids[0]
      const key = csId ?? "__none"
      const label = csId ? csLabelFor(csId) : "Not in any class"
      const g = groups.get(key) ?? { label, items: [] }
      g.items.push(m)
      groups.set(key, g)
    }
    return [...groups.entries()]
      .sort(([ka, a], [kb, b]) =>
        ka === "__none"
          ? 1
          : kb === "__none"
            ? -1
            : a.label.localeCompare(b.label)
      )
      .map(([key, g]) => ({ key, ...g }))
  }, [filteredMaterials, csLabelFor])

  const allFilteredSelected =
    filteredMaterials.length > 0 &&
    filteredMaterials.every((m) => selectedIds.has(m.id))

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const m of filteredMaterials) next.delete(m.id)
      } else {
        for (const m of filteredMaterials) next.add(m.id)
      }
      return next
    })
  }

  const toggleVisibility = async (material: Material) => {
    if (!canEdit) return
    const next = material.visibility === "private" ? "public" : "private"
    setTogglingIds((prev) => new Set(prev).add(material.id))
    try {
      await apiClient.patch(`/api/knowledge/material/${material.id}`, {
        visibility: next,
      })
      setMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, visibility: next } : m))
      )
      toast.success(
        next === "public"
          ? "Published to the school bank"
          : "Hidden from the school bank"
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update visibility"
      )
    } finally {
      setTogglingIds((prev) => {
        const nextSet = new Set(prev)
        nextSet.delete(material.id)
        return nextSet
      })
    }
  }

  // Bulk actions fan out to the existing single-item endpoints. Cheaper than
  // shipping bulk endpoints on day one, and the fan-out gives us per-item
  // pass/fail counts for the toast when a subset fails.
  const bulkTargets = () => materials.filter((m) => selectedIds.has(m.id))

  const bulkSetVisibility = async (next: "public" | "private") => {
    const targets = bulkTargets()
    if (targets.length === 0) return
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(
        targets.map((m) =>
          apiClient.patch(`/api/knowledge/material/${m.id}`, {
            visibility: next,
          })
        )
      )
      const ok = results.filter((r) => r.status === "fulfilled").length
      const fail = results.length - ok
      setMaterials((prev) =>
        prev.map((m) =>
          selectedIds.has(m.id) ? { ...m, visibility: next } : m
        )
      )
      if (fail === 0)
        toast.success(`${ok} material${ok === 1 ? "" : "s"} set to ${next}`)
      else toast.warning(`${ok} updated, ${fail} failed`)
      clearSelection()
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkShareTo = async (targetCsIds: string[]) => {
    const targets = bulkTargets()
    if (targets.length === 0 || targetCsIds.length === 0) return
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(
        targets.map((m) => {
          // Merge existing links with new targets; PATCH /links is replace-mode.
          const desired = Array.from(
            new Set([...(m.linked_class_subject_ids || []), ...targetCsIds])
          )
          return apiClient
            .patch<{
              linked_class_subject_ids: string[]
            }>(`/api/knowledge/material/${m.id}/links`, {
              class_subject_ids: desired,
            })
            .then((res) => ({
              id: m.id,
              linked: res.linked_class_subject_ids ?? desired,
            }))
        })
      )
      const ok = results.filter((r) => r.status === "fulfilled").length
      const fail = results.length - ok
      setMaterials((prev) =>
        prev.map((m) => {
          const hit = results.find(
            (r) => r.status === "fulfilled" && r.value.id === m.id
          )
          if (!hit || hit.status !== "fulfilled") return m
          return { ...m, linked_class_subject_ids: hit.value.linked }
        })
      )
      if (fail === 0)
        toast.success(
          `Shared to ${targetCsIds.length} class-subject${targetCsIds.length === 1 ? "" : "s"}`
        )
      else toast.warning(`${ok} updated, ${fail} failed`)
      clearSelection()
      setBulkPickerOpen(false)
    } finally {
      setBulkBusy(false)
    }
  }

  const confirmBulkDelete = async () => {
    const targets = bulkTargets()
    setBulkDeleteOpen(false)
    if (targets.length === 0) return
    setBulkBusy(true)
    setDeletingIds((prev) => {
      const next = new Set(prev)
      for (const t of targets) next.add(t.id)
      return next
    })
    try {
      const results = await Promise.allSettled(
        targets.map((m) => apiClient.delete(`/api/knowledge/material/${m.id}`))
      )
      const ok = results.filter((r) => r.status === "fulfilled").length
      const fail = results.length - ok
      // Optimistically drop the succeeded ones from the local list; keep the
      // ones that failed so the user can retry via the row-level trash.
      const okIds = new Set<string>()
      results.forEach((r, i) => {
        if (r.status === "fulfilled") okIds.add(targets[i].id)
      })
      setMaterials((prev) => prev.filter((m) => !okIds.has(m.id)))
      if (fail === 0)
        toast.success(`${ok} material${ok === 1 ? "" : "s"} removed`)
      else toast.warning(`${ok} removed, ${fail} failed`)
      clearSelection()
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        for (const t of targets) next.delete(t.id)
        return next
      })
      setBulkBusy(false)
    }
  }

  const requestDelete = (material: Material) => {
    if (!canEdit) return
    setPendingDelete(material)
  }

  const confirmDelete = async () => {
    const material = pendingDelete
    if (!material) return
    setPendingDelete(null)
    setDeletingIds((prev) => new Set(prev).add(material.id))
    try {
      const res = await apiClient.delete<{ storage_warning?: string | null }>(
        `/api/knowledge/material/${material.id}`
      )
      setMaterials((prev) => prev.filter((m) => m.id !== material.id))
      if (res?.storage_warning) {
        toast.warning(res.storage_warning)
      } else {
        toast.success("Material deleted")
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete material"
      )
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(material.id)
        return next
      })
    }
  }

  const retryProcessing = async (materialId: string) => {
    setRetryingIds((prev) => new Set(prev).add(materialId))
    try {
      const res = await apiClient.post<{ material: Material }>(
        "/api/knowledge/process-material",
        { material_id: materialId }
      )
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === res.material.id ? { ...m, ...res.material } : m
        )
      )
      toast.success("Material analyzed successfully")
    } catch (err) {
      // Surface the actual server error so upload retries stop feeling silent.
      const message = err instanceof Error ? err.message : "Processing failed"
      toast.error(message)
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev)
        next.delete(materialId)
        return next
      })
    }
  }

  const handleLinksSaved = (materialId: string, linkedIds: string[]) => {
    setMaterials((prev) =>
      prev.map((m) =>
        m.id === materialId ? { ...m, linked_class_subject_ids: linkedIds } : m
      )
    )
    fetchLibrary()
  }

  if (!user) return null

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <PageHeader
        icon={BookOpenIcon}
        title="Knowledge Library"
        description="Textbooks and notes the question generator draws from."
      >
        {isLoading && <PageToolbarSkeleton />}
        {!isLoading && materials.length > 0 && (
          <PageToolbar
            className="animate-in duration-300 fade-in-0"
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by title or tag…",
            }}
            summary={countSummary(
              filteredMaterials.length,
              materials.length,
              "material",
              Boolean(filterCsId) || search.trim().length > 0
            )}
            filters={
              filterChips.length > 0
                ? {
                    activeCount: filterCsId ? 1 : 0,
                    onClearAll: () => setFilterCsId(null),
                    resultLabel: `${filteredMaterials.length} of ${materials.length} materials`,
                    children: (
                      <MultiSelectField
                        icon={ChalkboardIcon}
                        label="Class"
                        placeholder="Any class"
                        options={filterChips.map((c) => ({
                          value: c.id,
                          label: c.label,
                        }))}
                        selected={filterCsId ? [filterCsId] : []}
                        onToggle={(v) =>
                          setFilterCsId((cur) => (cur === v ? null : v))
                        }
                        onClear={() => setFilterCsId(null)}
                        searchable={filterChips.length > 8}
                      />
                    ),
                  }
                : undefined
            }
            chips={
              filterCsId ? (
                <FilterChipGroup icon={ChalkboardIcon} label="Class">
                  <FilterChip
                    label={csLabelFor(filterCsId)}
                    onRemove={() => setFilterCsId(null)}
                  />
                </FilterChipGroup>
              ) : null
            }
          />
        )}
      </PageHeader>

      <LoadingSwap
        loading={isLoading}
        skeleton={<MaterialListSkeleton />}
        className="flex-1"
      >
        {filteredMaterials.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker
              name={materials.length === 0 ? "classroom" : "lost"}
              size={materials.length === 0 ? 200 : 120}
            />
            <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                {materials.length === 0
                  ? canEdit
                    ? "Your library is empty"
                    : "Nothing here yet"
                  : "Nothing matches that"}
              </p>
              <p className="text-sm text-muted-foreground">
                {materials.length === 0
                  ? canEdit
                    ? "Upload a textbook or notes and tag them to your classes. The question generator draws from whatever lives here."
                    : "Materials teachers upload will show up here."
                  : "Try a different word, or clear the class filter."}
              </p>
            </div>
            {materials.length === 0 && canEdit ? (
              <Button
                onClick={() => setUploadOpen(true)}
                disabled={teacherOptionCount === 0}
              >
                <UploadIcon className="size-3.5" />
                Upload a file
              </Button>
            ) : materials.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("")
                  setFilterCsId(null)
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <MaterialList
            meta={
              <>
                {canEdit && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="transition-colors hover:text-foreground"
                  >
                    {allFilteredSelected ? "Clear selection" : "Select all"}
                  </button>
                )}
                <span className="tabular-nums">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} of ${filteredMaterials.length} selected`
                    : `${filteredMaterials.length} ${filteredMaterials.length === 1 ? "material" : "materials"}`}
                </span>
                <span className="ml-auto">Newest first</span>
              </>
            }
          >
            {groupedMaterials.map((group) => (
              <MaterialGroup
                key={group.key}
                icon={ChalkboardIcon}
                label={group.label}
                count={group.items.length}
              >
                {group.items.map((m) => {
                  const Icon = getFileIcon(m.file_url)
                  const teacher = teachersMap[m.teacher_id]
                  const extraClasses = m.linked_class_subject_ids.slice(1)
                  const isSelected = selectedIds.has(m.id)
                  const subtitle = [
                    extraClasses.length > 0
                      ? `also in ${extraClasses.map(csLabelFor).join(", ")}`
                      : null,
                    (m.tags ?? []).join(", ") || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                  return (
                    <MaterialRow
                      key={m.id}
                      icon={Icon}
                      iconTitle={fileKind(m.file_url)}
                      title={m.title}
                      subtitle={subtitle || undefined}
                      onOpen={() =>
                        window.open(m.file_url, "_blank", "noopener")
                      }
                      select={
                        canEdit
                          ? {
                              checked: isSelected,
                              onChange: () => toggleSelected(m.id),
                              label: `Select ${m.title}`,
                            }
                          : undefined
                      }
                      right={
                        <>
                          {/* Status */}
                          <span className="flex w-24 items-center gap-1.5">
                            {m.processed ? (
                              <>
                                <CheckCircleIcon
                                  weight="fill"
                                  className="size-4 text-emerald-500"
                                />
                                Analyzed
                              </>
                            ) : processingIds.has(m.id) ? (
                              <>
                                <CircleNotchIcon className="size-4 animate-spin text-violet-500" />
                                Processing
                              </>
                            ) : canEdit ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => retryProcessing(m.id)}
                                    disabled={retryingIds.has(m.id)}
                                    className="flex items-center gap-1.5 text-amber-600 transition-colors hover:text-amber-700 disabled:opacity-70 dark:text-amber-400"
                                  >
                                    {retryingIds.has(m.id) ? (
                                      <CircleNotchIcon className="size-4 animate-spin" />
                                    ) : (
                                      <ArrowsClockwiseIcon className="size-4" />
                                    )}
                                    {retryingIds.has(m.id)
                                      ? "Retrying"
                                      : "Retry"}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Analysis failed — click to retry
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <>
                                <WarningCircleIcon
                                  weight="fill"
                                  className="size-4 text-amber-500"
                                />
                                Not analyzed
                              </>
                            )}
                          </span>

                          {/* Visibility */}
                          {canEdit ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => toggleVisibility(m)}
                                  disabled={togglingIds.has(m.id)}
                                  className={cn(
                                    "flex w-16 items-center gap-1.5 transition-colors disabled:opacity-50",
                                    m.visibility === "private"
                                      ? "hover:text-foreground"
                                      : "text-sky-600 hover:text-sky-700 dark:text-sky-400"
                                  )}
                                >
                                  {m.visibility === "private" ? (
                                    <LockSimpleIcon className="size-4" />
                                  ) : (
                                    <GlobeHemisphereWestIcon className="size-4" />
                                  )}
                                  {togglingIds.has(m.id)
                                    ? "…"
                                    : m.visibility === "private"
                                      ? "Private"
                                      : "Public"}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {m.visibility === "private"
                                  ? "Private — click to publish to the shared library"
                                  : "Public in the shared library — click to make private"}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span
                              className={cn(
                                "flex w-16 items-center gap-1.5",
                                m.visibility !== "private" &&
                                  "text-sky-600 dark:text-sky-400"
                              )}
                            >
                              {m.visibility === "private" ? (
                                <LockSimpleIcon className="size-4" />
                              ) : (
                                <GlobeHemisphereWestIcon className="size-4" />
                              )}
                              {m.visibility === "private"
                                ? "Private"
                                : "Public"}
                            </span>
                          )}

                          {/* Uploader (viewers only — teachers know it's theirs) */}
                          {!canEdit && teacher && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar className="size-5">
                                  {teacher.profile_url ? (
                                    <AvatarImage
                                      src={teacher.profile_url}
                                      alt={teacher.full_name}
                                    />
                                  ) : null}
                                  <AvatarFallback className="text-[8px]">
                                    {initials(teacher.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                {teacher.full_name}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Age */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="w-14 text-right tabular-nums">
                                {timeAgo(m.uploaded_at)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {dayjs(m.uploaded_at).format("D MMM YYYY")}
                            </TooltipContent>
                          </Tooltip>

                          {/* Menu */}
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="More"
                                  className="-mr-1 text-muted-foreground"
                                >
                                  <DotsThreeIcon
                                    weight="bold"
                                    className="size-4"
                                  />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onSelect={() => setEditLinksFor(m)}
                                >
                                  <LinkSimpleIcon className="size-3.5" />
                                  Share to classes…
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => toggleVisibility(m)}
                                >
                                  {m.visibility === "private" ? (
                                    <>
                                      <GlobeHemisphereWestIcon className="size-3.5" />
                                      Make public
                                    </>
                                  ) : (
                                    <>
                                      <LockSimpleIcon className="size-3.5" />
                                      Make private
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={deletingIds.has(m.id)}
                                  onSelect={() => requestDelete(m)}
                                >
                                  <TrashIcon className="size-3.5" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      }
                    />
                  )
                })}
              </MaterialGroup>
            ))}
          </MaterialList>
        )}
      </LoadingSwap>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        options={teacherOptions}
        onComplete={(newMaterials) => {
          setMaterials((prev) => [...newMaterials, ...prev])
          setProcessingIds((prev) => {
            const next = new Set(prev)
            for (const m of newMaterials) next.add(m.id)
            return next
          })
          fetchLibrary()
          // Kick off processing in the background
          Promise.allSettled(
            newMaterials.map((mat) =>
              apiClient.post<{ material: Material }>(
                "/api/knowledge/process-material",
                { material_id: mat.id }
              )
            )
          ).then((results) => {
            for (let i = 0; i < results.length; i++) {
              const r = results[i]
              if (r.status === "fulfilled") {
                setMaterials((prev) =>
                  prev.map((m) =>
                    m.id === r.value.material.id
                      ? { ...m, ...r.value.material }
                      : m
                  )
                )
              }
            }
            setProcessingIds((prev) => {
              const next = new Set(prev)
              for (const mat of newMaterials) next.delete(mat.id)
              return next
            })
          })
        }}
      />

      <MaterialLinksDialog
        open={!!editLinksFor}
        onOpenChange={(o) => !o && setEditLinksFor(null)}
        material={editLinksFor}
        options={teacherOptions}
        primaryLabel={csLabelFor}
        onSaved={handleLinksSaved}
      />

      {selectedIds.size > 0 && (
        /* Sticky inside the page rather than fixed to the viewport, so it
           centres on the content column, not on the window behind the sidebar. */
        <div className="sticky bottom-4 z-40 mx-auto mt-2 w-fit max-w-full animate-in duration-200 fade-in-0 slide-in-from-bottom-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur">
            <span className="flex items-center gap-2 pr-2 pl-2.5 text-sm">
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium text-primary-foreground tabular-nums">
                {selectedIds.size}
              </span>
              selected
            </span>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              onClick={() => bulkSetVisibility("public")}
              disabled={bulkBusy}
            >
              <GlobeHemisphereWestIcon className="size-3.5" />
              Make public
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              onClick={() => bulkSetVisibility("private")}
              disabled={bulkBusy}
            >
              <LockSimpleIcon className="size-3.5" />
              Make private
            </Button>

            <Popover open={bulkPickerOpen} onOpenChange={setBulkPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs"
                  disabled={bulkBusy}
                >
                  <ShareNetworkIcon className="size-3.5" />
                  Share to…
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" side="top" className="w-64 p-2">
                <BulkSharePicker
                  assignments={assignments ?? []}
                  onCancel={() => setBulkPickerOpen(false)}
                  onApply={bulkShareTo}
                  busy={bulkBusy}
                />
              </PopoverContent>
            </Popover>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkBusy}
            >
              <TrashIcon className="size-3.5" />
              Remove
            </Button>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Clear selection"
              onClick={clearSelection}
              disabled={bulkBusy}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {selectedIds.size} material
              {selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Each material will be removed from every one of your classes and,
              if you uploaded it, retired from the school shared library. Any
              teacher who already picked it into their own class keeps it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this material?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {pendingDelete?.title ?? ""}
              </span>{" "}
              will be removed from every class you have it linked to. If you
              uploaded it, it will also stop appearing in the school knowledge
              bank. Any teacher who already picked it into their own class keeps
              their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: ClassSubjectOption[]
  onComplete: (materials: Material[]) => void
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function UploadDialog({
  open,
  onOpenChange,
  options,
  onComplete,
}: UploadDialogProps) {
  const [selectedCs, setSelectedCs] = useState<string[]>([])
  const [files, setFiles] = useState<{ file: File; title: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setSelectedCs([])
      setFiles([])
      setDragging(false)
    }
  }, [open])

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return
    const newEntries: { file: File; title: string }[] = []
    const tooBig: string[] = []
    const wrongType: string[] = []

    for (const file of Array.from(list)) {
      const ok =
        file.type === "application/pdf" || file.type.startsWith("image/")
      if (!ok) {
        wrongType.push(file.name)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        tooBig.push(file.name)
        continue
      }
      newEntries.push({ file, title: file.name.replace(/\.[^/.]+$/, "") })
    }

    if (tooBig.length > 0)
      toast.error(
        tooBig.length === 1
          ? `${tooBig[0]} is over 50 MB and was skipped`
          : `${tooBig.length} files over 50 MB were skipped`
      )
    if (wrongType.length > 0)
      toast.error(
        wrongType.length === 1
          ? `${wrongType[0]} isn't a PDF or image`
          : `${wrongType.length} files weren't PDFs or images`
      )

    if (newEntries.length > 0) setFiles((prev) => [...prev, ...newEntries])
    if (inputRef.current) inputRef.current.value = ""
  }

  const missingTitle = files.some((f) => f.title.trim().length === 0)
  const canUpload = selectedCs.length > 0 && files.length > 0 && !missingTitle

  // Why the button is off, in words, so nobody has to guess.
  const blocker =
    files.length === 0
      ? "Add at least one file"
      : selectedCs.length === 0
        ? "Pick at least one class"
        : missingTitle
          ? "Every file needs a title"
          : null

  const handleUpload = async () => {
    if (!canUpload) return
    const [primaryCs, ...additionalCs] = selectedCs

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("class_subject_id", primaryCs)
      formData.append(
        "additional_class_subject_ids",
        JSON.stringify(additionalCs)
      )
      formData.append(
        "titles",
        JSON.stringify(files.map((f) => f.title.trim()))
      )
      files.forEach((f) => formData.append("files", f.file))

      const token = localStorage.getItem("access_token")
      const BASE_URL = import.meta.env.VITE_API_BASE_URL as string
      const res = await fetch(`${BASE_URL}/api/knowledge/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error("Upload failed")
      const json = (await res.json()) as {
        results: ({ material: Material } | { title: string; error: string })[]
      }

      const uploaded: Material[] = []
      for (const r of json.results) {
        if ("material" in r) uploaded.push(r.material)
        else toast.error(`${r.title} failed: ${r.error}`)
      }
      if (uploaded.length > 0)
        toast.success(
          uploaded.length === 1
            ? "1 file uploaded. Analysis has started."
            : `${uploaded.length} files uploaded. Analysis has started.`
        )
      onComplete(uploaded)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Upload materials</DialogTitle>
          <DialogDescription>
            Add textbooks, chapters, or notes. Each file is analysed so Ask Hint
            and the question generator can draw from it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-6 pb-6">
          {/* Step 1 — files */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-secondary-foreground">
                <span className="mr-1.5 text-muted-foreground">1</span>
                Files
              </p>
              {files.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {files.length} {files.length === 1 ? "file" : "files"}
                </span>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,image/*"
              onChange={(e) => addFiles(e.target.files)}
              className="hidden"
            />

            {/* Drop zone */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                if (!dragging) setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles(e.dataTransfer.files)
              }}
              disabled={uploading}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                files.length === 0 ? "py-8" : "py-4",
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-sidebar hover:border-foreground/25"
              )}
            >
              {files.length === 0 && <Sticker name="point" size={56} />}
              <span className="text-sm text-foreground">
                <span className="font-medium">
                  {dragging ? "Drop to add" : "Drop files here"}
                </span>
                {!dragging && (
                  <span className="text-muted-foreground">
                    {" "}
                    or click to browse
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                PDF or images · up to 50 MB each
              </span>
            </button>

            {files.length > 0 && (
              <ul className="flex flex-col gap-2">
                {files.map((entry, idx) => {
                  const Icon = getFileIcon(entry.file.name)
                  const empty = entry.title.trim().length === 0
                  return (
                    <li
                      key={`${entry.file.name}-${idx}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-sidebar">
                        <Icon className="size-4 text-muted-foreground" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Input
                          value={entry.title}
                          onChange={(e) =>
                            setFiles((prev) =>
                              prev.map((f, i) =>
                                i === idx ? { ...f, title: e.target.value } : f
                              )
                            )
                          }
                          placeholder="Give this file a title"
                          aria-label="Title"
                          aria-invalid={empty || undefined}
                          className={cn(
                            "h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0",
                            empty && "placeholder:text-destructive/70"
                          )}
                        />
                        <span className="truncate text-[11px] text-muted-foreground">
                          {entry.file.name} · {formatBytes(entry.file.size)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${entry.file.name}`}
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        disabled={uploading}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Step 2 — classes */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-secondary-foreground">
                <span className="mr-1.5 text-muted-foreground">2</span>
                Which classes should see {files.length === 1 ? "it" : "them"}?
              </p>
              {selectedCs.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {selectedCs.length} of {options.length}
                </span>
              )}
            </div>
            <ClassSubjectMultiSelect
              options={options}
              value={selectedCs}
              onChange={setSelectedCs}
              disabled={uploading}
              firstLabel="Primary"
              placeholder="Choose one or more classes…"
              emptyLabel="You aren't assigned to a class yet, so there's nowhere to upload to."
            />
            {options.length > 1 && (
              <p className="text-xs text-muted-foreground">
                The first class you tick keeps the file. The others get a link
                to it, so there is only ever one copy.
              </p>
            )}
          </section>
        </div>

        <DialogFooter className="flex-row items-center border-t border-border bg-sidebar px-6 py-3 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {blocker ??
              `${files.length} ${files.length === 1 ? "file" : "files"} → ${selectedCs.length} ${selectedCs.length === 1 ? "class" : "classes"}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!canUpload || uploading}>
              {uploading ? (
                <CircleNotchIcon className="size-3.5 animate-spin" />
              ) : (
                <UploadIcon className="size-3.5" />
              )}
              {uploading
                ? "Uploading…"
                : files.length > 1
                  ? `Upload ${files.length} files`
                  : "Upload"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Small in-line picker used inside the bulk action bar's "Share to…" popover.
// Lets the teacher tick multiple of their own class-subjects and apply — the
// parent handler merges the picks into each selected material's link set.
interface BulkAssignmentLike {
  class_subject_id: string
  class: { id: string; grade: number; section: string } | null
  subject: { id: string; subject_name: string } | null
}
function BulkSharePicker({
  assignments,
  onCancel,
  onApply,
  busy,
}: {
  assignments: BulkAssignmentLike[]
  onCancel: () => void
  onApply: (ids: string[]) => void
  busy: boolean
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (assignments.length === 0) {
    return (
      <p className="p-2 text-xs text-muted-foreground">
        You aren&apos;t assigned to any classes yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      <p className="p-2 text-[10px] text-muted-foreground">
        Add every selected material to
      </p>
      <div className="max-h-64 overflow-y-auto">
        {assignments.map((a) => {
          const isOn = checked.has(a.class_subject_id)
          return (
            <button
              key={a.class_subject_id}
              type="button"
              onClick={() => toggle(a.class_subject_id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border",
                  isOn
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30"
                )}
              >
                {isOn && <CheckIcon className="size-3" />}
              </span>
              <span className="truncate">
                {a.class ? `Grade ${a.class.grade}${a.class.section}` : "Class"}
                {" · "}
                {a.subject?.subject_name ?? "Subject"}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex items-center justify-end gap-1 border-t pt-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={checked.size === 0 || busy}
          onClick={() => onApply(Array.from(checked))}
        >
          {busy ? "Applying…" : "Add"}
        </Button>
      </div>
    </div>
  )
}
