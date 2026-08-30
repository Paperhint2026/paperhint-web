import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BookOpenIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Link2Icon,
  Loader2Icon,
  RefreshCwIcon,
  Share2Icon,
  SparklesIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import {
  useTeacherAssignments,
  classLabel,
} from "@/hooks/use-teacher-assignments"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
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

  const [materials, setMaterials] = useState<Material[]>([])
  const [csLabels, setCsLabels] = useState<Record<string, ClassSubjectLabel>>({})
  const [teachersMap, setTeachersMap] = useState<Record<string, TeacherLite>>({})
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

  const teacherOptions = useMemo<ClassSubjectOption[]>(
    () =>
      assignments.map((a) => ({
        class_subject_id: a.class_subject_id,
        label: classLabel(a),
      })),
    [assignments],
  )

  const csLabelFor = useCallback(
    (csId: string) => {
      const fromLabels = csLabels[csId]
      if (fromLabels) return formatClassSubjectLabel(fromLabels)
      const fromAssign = assignments.find((a) => a.class_subject_id === csId)
      return fromAssign ? classLabel(fromAssign) : "Unknown class"
    },
    [csLabels, assignments],
  )

  // Build filter chips from the union of all class-subjects referenced by
  // any material the user can see.
  const filterChips = useMemo(() => {
    const ids = new Set<string>()
    for (const m of materials) for (const cs of m.linked_class_subject_ids) ids.add(cs)
    return [...ids]
      .map((id) => ({ id, label: csLabelFor(id) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [materials, csLabelFor])

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (filterCsId && !m.linked_class_subject_ids.includes(filterCsId)) return false
      if (search) {
        const q = search.toLowerCase()
        const inTitle = m.title.toLowerCase().includes(q)
        const inTags = (m.tags || []).some((t) => t.toLowerCase().includes(q))
        if (!inTitle && !inTags) return false
      }
      return true
    })
  }, [materials, filterCsId, search])

  const toggleVisibility = async (material: Material) => {
    if (!canEdit) return
    const next = material.visibility === "private" ? "public" : "private"
    setTogglingIds((prev) => new Set(prev).add(material.id))
    try {
      await apiClient.patch(`/api/knowledge/material/${material.id}`, {
        visibility: next,
      })
      setMaterials((prev) =>
        prev.map((m) => (m.id === material.id ? { ...m, visibility: next } : m)),
      )
      toast.success(
        next === "public"
          ? "Published to the school bank"
          : "Hidden from the school bank",
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update visibility")
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
          apiClient.patch(`/api/knowledge/material/${m.id}`, { visibility: next }),
        ),
      )
      const ok = results.filter((r) => r.status === "fulfilled").length
      const fail = results.length - ok
      setMaterials((prev) =>
        prev.map((m) =>
          selectedIds.has(m.id) ? { ...m, visibility: next } : m,
        ),
      )
      if (fail === 0) toast.success(`${ok} material${ok === 1 ? "" : "s"} set to ${next}`)
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
            new Set([...(m.linked_class_subject_ids || []), ...targetCsIds]),
          )
          return apiClient
            .patch<{ linked_class_subject_ids: string[] }>(
              `/api/knowledge/material/${m.id}/links`,
              { class_subject_ids: desired },
            )
            .then((res) => ({
              id: m.id,
              linked: res.linked_class_subject_ids ?? desired,
            }))
        }),
      )
      const ok = results.filter((r) => r.status === "fulfilled").length
      const fail = results.length - ok
      setMaterials((prev) =>
        prev.map((m) => {
          const hit = results.find(
            (r) => r.status === "fulfilled" && r.value.id === m.id,
          )
          if (!hit || hit.status !== "fulfilled") return m
          return { ...m, linked_class_subject_ids: hit.value.linked }
        }),
      )
      if (fail === 0) toast.success(`Shared to ${targetCsIds.length} class-subject${targetCsIds.length === 1 ? "" : "s"}`)
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
        targets.map((m) => apiClient.delete(`/api/knowledge/material/${m.id}`)),
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
      if (fail === 0) toast.success(`${ok} material${ok === 1 ? "" : "s"} removed`)
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
        `/api/knowledge/material/${material.id}`,
      )
      setMaterials((prev) => prev.filter((m) => m.id !== material.id))
      if (res?.storage_warning) {
        toast.warning(res.storage_warning)
      } else {
        toast.success("Material deleted")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete material")
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
        { material_id: materialId },
      )
      setMaterials((prev) =>
        prev.map((m) => (m.id === res.material.id ? { ...m, ...res.material } : m)),
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
        m.id === materialId ? { ...m, linked_class_subject_ids: linkedIds } : m,
      ),
    )
    fetchLibrary()
  }

  if (!user) return null

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background/60 px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-lg font-semibold">Knowledge Library</h1>
            <p className="text-xs text-muted-foreground">
              {canEdit
                ? "Upload once, tag any class-subject you teach. Reuse across sections."
                : "All materials uploaded by teachers in your school."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or tag..."
                className="h-8 w-56 pr-7 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </div>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => setUploadOpen(true)}
                disabled={teacherOptions.length === 0}
                title={
                  teacherOptions.length === 0
                    ? "You need to be assigned to a class-subject first"
                    : undefined
                }
              >
                <UploadIcon className="size-3.5" />
                Upload
              </Button>
            )}
          </div>
        </div>

        {filterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCsId(null)}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                filterCsId === null
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              All ({materials.length})
            </button>
            {filterChips.map((c) => {
              const count = materials.filter((m) =>
                m.linked_class_subject_ids.includes(c.id),
              ).length
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    setFilterCsId((prev) => (prev === c.id ? null : c.id))
                  }
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    filterCsId === c.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {c.label} ({count})
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
            <BookOpenIcon className="size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">
              {materials.length === 0
                ? canEdit
                  ? "Your knowledge library is empty"
                  : "No materials uploaded yet"
                : "No materials match this filter"}
            </p>
            <p className="text-xs text-muted-foreground">
              {materials.length === 0 && canEdit
                ? "Upload a file and tag it to one or more of your class-subjects. It will show up in every tagged class's knowledge view."
                : "Try clearing the filters above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMaterials.map((m) => {
              const Icon = getFileIcon(m.file_url)
              const teacher = teachersMap[m.teacher_id]
              return (
                <div
                  key={m.id}
                  role={canEdit ? "button" : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                  aria-pressed={canEdit ? selectedIds.has(m.id) : undefined}
                  onClick={canEdit ? () => toggleSelected(m.id) : undefined}
                  onKeyDown={
                    canEdit
                      ? (e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault()
                            toggleSelected(m.id)
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "group relative flex flex-col gap-2.5 rounded-xl border bg-background p-3 transition-colors hover:border-foreground/20 hover:bg-muted/20",
                    canEdit && "cursor-pointer",
                    selectedIds.has(m.id) &&
                      "border-primary bg-primary/[0.06] hover:border-primary hover:bg-primary/[0.08]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-tight">
                        {m.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(m.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    {m.processed ? (
                      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                        <SparklesIcon className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                      </span>
                    ) : processingIds.has(m.id) ? (
                      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
                        <Loader2Icon className="size-2.5 animate-spin text-blue-600 dark:text-blue-400" />
                      </span>
                    ) : canEdit ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          retryProcessing(m.id)
                        }}
                        disabled={retryingIds.has(m.id)}
                        title={retryingIds.has(m.id) ? "Retrying…" : "Retry processing"}
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 transition-colors hover:bg-amber-500/25 disabled:opacity-70"
                      >
                        {retryingIds.has(m.id) ? (
                          <Loader2Icon className="size-2.5 animate-spin text-amber-600 dark:text-amber-400" />
                        ) : (
                          <RefreshCwIcon className="size-2.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {m.linked_class_subject_ids.length > 0 ? (
                      m.linked_class_subject_ids.map((csId) => (
                        <span
                          key={csId}
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] leading-none text-primary"
                        >
                          {csLabelFor(csId)}
                        </span>
                      ))
                    ) : (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                        Unlinked
                      </span>
                    )}
                  </div>

                  {m.tags && m.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      {m.tags.length > 4 && (
                        <span className="text-[10px] text-muted-foreground/60">
                          +{m.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-1">
                    {!canEdit && teacher ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="size-5">
                          {teacher.profile_url ? (
                            <AvatarImage src={teacher.profile_url} alt={teacher.full_name} />
                          ) : null}
                          <AvatarFallback className="text-[9px]">
                            {initials(teacher.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {teacher.full_name}
                        </span>
                      </div>
                    ) : (
                      <span />
                    )}

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleVisibility(m)
                          }}
                          disabled={togglingIds.has(m.id)}
                          title={
                            m.visibility === "private"
                              ? "Private — click to publish to the school bank"
                              : "Public in the school bank — click to make private"
                          }
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50",
                            m.visibility === "private"
                              ? "bg-muted text-muted-foreground hover:bg-muted/70"
                              : "bg-primary/10 text-primary hover:bg-primary/20",
                          )}
                        >
                          {togglingIds.has(m.id)
                            ? "…"
                            : m.visibility === "private"
                              ? "Private"
                              : "Public"}
                        </button>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditLinksFor(m)
                            }}
                            title="Share to other class-subjects"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Link2Icon className="size-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              requestDelete(m)
                            }}
                            disabled={deletingIds.has(m.id)}
                            title="Delete material"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
                          >
                            {deletingIds.has(m.id) ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2Icon className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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
                { material_id: mat.id },
              ),
            ),
          ).then((results) => {
            for (let i = 0; i < results.length; i++) {
              const r = results[i]
              if (r.status === "fulfilled") {
                setMaterials((prev) =>
                  prev.map((m) =>
                    m.id === r.value.material.id ? { ...m, ...r.value.material } : m,
                  ),
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
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
            <span className="pl-1 pr-2 text-sm font-medium">
              {selectedIds.size} selected
            </span>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={() => bulkSetVisibility("public")}
              disabled={bulkBusy}
            >
              <EyeIcon className="size-3.5" />
              Make Public
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={() => bulkSetVisibility("private")}
              disabled={bulkBusy}
            >
              <EyeOffIcon className="size-3.5" />
              Make Private
            </Button>

            <Popover open={bulkPickerOpen} onOpenChange={setBulkPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 rounded-full text-xs"
                  disabled={bulkBusy}
                >
                  <Share2Icon className="size-3.5" />
                  Share to…
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-64 p-2">
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
              variant="outline"
              className="h-8 gap-1.5 rounded-full text-xs text-destructive hover:text-destructive"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkBusy}
            >
              <Trash2Icon className="size-3.5" />
              Remove
            </Button>

            <Separator orientation="vertical" className="h-5" />

            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={clearSelection}
              disabled={bulkBusy}
            >
              <XIcon className="size-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {selectedIds.size} material{selectedIds.size === 1 ? "" : "s"}?
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
              uploaded it, it will also stop appearing in the school
              knowledge bank. Any teacher who already picked it into their
              own class keeps their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

function UploadDialog({ open, onOpenChange, options, onComplete }: UploadDialogProps) {
  const [selectedCs, setSelectedCs] = useState<string[]>([])
  const [files, setFiles] = useState<{ file: File; title: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setSelectedCs([])
      setFiles([])
    }
  }, [open])

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list) return

    const newEntries: { file: File; title: string }[] = []
    const skipped: string[] = []

    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_SIZE) {
        skipped.push(file.name)
        continue
      }
      newEntries.push({ file, title: file.name.replace(/\.[^/.]+$/, "") })
    }

    if (skipped.length > 0) {
      toast.error(`Skipped ${skipped.length} file(s) over 50MB`)
    }

    setFiles((prev) => [...prev, ...newEntries])
    if (inputRef.current) inputRef.current.value = ""
  }

  const canUpload =
    selectedCs.length > 0 &&
    files.length > 0 &&
    files.every((f) => f.title.trim().length > 0)

  const handleUpload = async () => {
    if (!canUpload) return
    const [primaryCs, ...additionalCs] = selectedCs

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("class_subject_id", primaryCs)
      formData.append("additional_class_subject_ids", JSON.stringify(additionalCs))
      formData.append("titles", JSON.stringify(files.map((f) => f.title.trim())))
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
        else toast.error(`Failed: ${r.title} — ${r.error}`)
      }
      if (uploaded.length > 0) toast.success(`${uploaded.length} material(s) uploaded`)
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
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload materials</DialogTitle>
          <DialogDescription>
            Pick the class-subjects where these files should appear. The first
            one you pick is the primary upload context.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Class-subjects ({selectedCs.length} selected)
            </p>
            <ClassSubjectMultiSelect
              options={options}
              value={selectedCs}
              onChange={setSelectedCs}
              emptyLabel="You are not yet assigned to any class-subjects."
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Files ({files.length})
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <UploadIcon className="size-3.5" />
                Add files
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={handleFiles}
                className="hidden"
              />
            </div>

            {files.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                No files selected. Supports PDF and images up to 50 MB.
              </div>
            ) : (
              <div className="space-y-1.5">
                {files.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                  >
                    <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <Input
                        value={entry.title}
                        onChange={(e) =>
                          setFiles((prev) =>
                            prev.map((f, i) =>
                              i === idx ? { ...f, title: e.target.value } : f,
                            ),
                          )
                        }
                        placeholder="File title"
                        className="h-6 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                      />
                      <p className="truncate text-[9px] text-muted-foreground">
                        {entry.file.name}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      disabled={uploading}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Separator />

        <DialogFooter className="gap-2 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!canUpload || uploading}>
            {uploading && <Loader2Icon className="size-3.5 animate-spin" />}
            Upload
          </Button>
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
      <p className="p-2 text-[10px] uppercase tracking-wide text-muted-foreground">
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
                    : "border-muted-foreground/30",
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
          className="h-7 rounded-full text-xs"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 rounded-full text-xs"
          disabled={checked.size === 0 || busy}
          onClick={() => onApply(Array.from(checked))}
        >
          {busy ? "Applying…" : "Add"}
        </Button>
      </div>
    </div>
  )
}
