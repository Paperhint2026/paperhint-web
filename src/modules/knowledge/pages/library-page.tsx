import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BookOpenIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Link2Icon,
  Loader2Icon,
  RefreshCwIcon,
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
import { Separator } from "@/components/ui/separator"
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

  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

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

  const handleDelete = async (material: Material) => {
    if (!canEdit) return
    const ok = window.confirm(`Delete "${material.title}"? This cannot be undone.`)
    if (!ok) return
    setDeletingIds((prev) => new Set(prev).add(material.id))
    try {
      await apiClient.delete(`/api/knowledge/material/${material.id}`)
      setMaterials((prev) => prev.filter((m) => m.id !== material.id))
      toast.success("Material deleted")
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
    } catch {
      toast.error("Processing failed. Please try again.")
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
                  className="group flex flex-col gap-2.5 rounded-xl border bg-background p-3 transition-colors hover:border-foreground/20 hover:bg-muted/20"
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
                        onClick={() => retryProcessing(m.id)}
                        disabled={retryingIds.has(m.id)}
                        title="Retry processing"
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 transition-colors hover:bg-amber-500/25"
                      >
                        <RefreshCwIcon className="size-2.5 text-amber-600 dark:text-amber-400" />
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
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => setEditLinksFor(m)}
                          title="Share to other class-subjects"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Link2Icon className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
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
