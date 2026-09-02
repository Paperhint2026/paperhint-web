import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  BookOpenIcon,
  CheckCircleIcon,
  DotsThreeIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  LinkSimpleIcon,
  CircleNotchIcon,
  ArrowsClockwiseIcon,
  TrashIcon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from "@phosphor-icons/react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
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
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { ClassPageHeader } from "@/components/layout/class-page-header"
import { Sticker } from "@/components/shared/sticker"
import { LoadingSwap } from "@/components/shared/loading-swap"
import { timeAgo } from "@/lib/time"
import {
  MaterialList,
  MaterialListSkeleton,
  MaterialRow,
} from "@/modules/knowledge/components/material-list"
import { Input } from "@/components/ui/input"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  type ClassSubjectLabel,
  formatClassSubjectLabel,
  type Material,
} from "@/modules/knowledge/lib/types"

function getFileIcon(url: string) {
  const lower = url.toLowerCase()
  if (lower.endsWith(".pdf")) return FileTextIcon
  if (/\.(jpe?g|png|webp|gif|svg)/.test(lower)) return ImageIcon
  return FileIcon
}

export function KnowledgePage() {
  const { user } = useAuth()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()
  const { assignments } = useTeacherAssignments()
  const isTeacher = user?.role === "teacher"

  const [materials, setMaterials] = useState<Material[]>([])
  const [csLabels, setCsLabels] = useState<Record<string, ClassSubjectLabel>>(
    {}
  )
  const [canEdit, setCanEdit] = useState(isTeacher)
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)

  const [selectedFiles, setSelectedFiles] = useState<
    { file: File; title: string }[]
  >([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [extraClassSubjectIds, setExtraClassSubjectIds] = useState<string[]>([])

  const [isUploading, setIsUploading] = useState(false)
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  const [editLinksFor, setEditLinksFor] = useState<Material | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Material | null>(null)

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

  // Teacher's other class-subjects she can also link to
  const shareOptions = useMemo<ClassSubjectOption[]>(() => {
    if (!classSubjectId) return []
    return assignments
      .filter((a) => a.class_subject_id !== classSubjectId)
      .map((a) => ({
        class_subject_id: a.class_subject_id,
        label: classLabel(a),
      }))
  }, [assignments, classSubjectId])

  const allLinkOptions = useMemo<ClassSubjectOption[]>(
    () =>
      assignments.map((a) => ({
        class_subject_id: a.class_subject_id,
        label: classLabel(a),
      })),
    [assignments]
  )

  const primaryLabel = useCallback(
    (csId: string) => {
      const fromLabels = csLabels[csId]
      if (fromLabels) return formatClassSubjectLabel(fromLabels)
      const fromAssign = assignments.find((a) => a.class_subject_id === csId)
      return fromAssign ? classLabel(fromAssign) : "Unknown class"
    },
    [csLabels, assignments]
  )

  const fetchMaterials = useCallback(async (csId: string) => {
    setIsLoadingMaterials(true)
    try {
      const res = await apiClient.get<{
        materials: Material[]
        class_subjects: ClassSubjectLabel[]
        can_edit: boolean
      }>(`/api/knowledge/materials/${csId}`)
      setMaterials(res.materials ?? [])
      const map: Record<string, ClassSubjectLabel> = {}
      for (const cs of res.class_subjects ?? []) map[cs.class_subject_id] = cs
      setCsLabels(map)
      setCanEdit(res.can_edit)
    } catch (err) {
      console.error("Failed to fetch materials:", err)
      setMaterials([])
    } finally {
      setIsLoadingMaterials(false)
    }
  }, [])

  useEffect(() => {
    if (classSubjectId) fetchMaterials(classSubjectId)
  }, [classSubjectId, fetchMaterials])

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newEntries: { file: File; title: string }[] = []
    const skipped: string[] = []

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        skipped.push(file.name)
        continue
      }
      const title = file.name.replace(/\.[^/.]+$/, "")
      newEntries.push({ file, title })
    }

    if (skipped.length > 0) {
      toast.error(
        `Skipped ${skipped.length} file(s) exceeding 50MB: ${skipped.join(", ")}`
      )
    }

    setSelectedFiles((prev) => [...prev, ...newEntries])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const updateFileTitle = (idx: number, title: string) => {
    setSelectedFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, title } : f))
    )
  }

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleUploadAndProcess = async () => {
    if (selectedFiles.length === 0 || !classSubjectId) return
    if (selectedFiles.some((f) => !f.title.trim())) {
      return toast.error("All files need a title")
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("class_subject_id", classSubjectId)
      formData.append(
        "additional_class_subject_ids",
        JSON.stringify(extraClassSubjectIds)
      )
      formData.append(
        "titles",
        JSON.stringify(selectedFiles.map((f) => f.title.trim()))
      )
      selectedFiles.forEach((f) => formData.append("files", f.file))

      const token = localStorage.getItem("access_token")
      const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

      const uploadRes = await fetch(`${BASE_URL}/api/knowledge/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!uploadRes.ok) throw new Error("Upload failed")

      const uploadData = (await uploadRes.json()) as {
        results: ({ material: Material } | { title: string; error: string })[]
      }

      const uploaded: Material[] = []
      for (const r of uploadData.results) {
        if ("material" in r) uploaded.push(r.material)
        else toast.error(`Failed: ${r.title} — ${r.error}`)
      }

      const uploadedIds = new Set(uploaded.map((m) => m.id))
      setMaterials((prev) => [...uploaded, ...prev])
      setProcessingIds((prev) => new Set([...prev, ...uploadedIds]))
      setSelectedFiles([])
      setExtraClassSubjectIds([])

      // Refresh labels so newly-linked ids have names
      if (classSubjectId) fetchMaterials(classSubjectId)

      const processResults = await Promise.allSettled(
        uploaded.map((mat) =>
          apiClient.post<{ material: Material }>(
            "/api/knowledge/process-material",
            { material_id: mat.id }
          )
        )
      )

      let successCount = 0
      for (let i = 0; i < processResults.length; i++) {
        const result = processResults[i]
        if (result.status === "fulfilled") {
          successCount++
          setMaterials((prev) =>
            prev.map((m) =>
              m.id === result.value.material.id
                ? { ...m, ...result.value.material }
                : m
            )
          )
        } else {
          toast.error(`Processing failed for "${uploaded[i].title}"`)
        }
      }

      setProcessingIds((prev) => {
        const next = new Set(prev)
        uploadedIds.forEach((id) => next.delete(id))
        return next
      })

      toast.success(`${successCount} material(s) uploaded and analyzed`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again."
      toast.error(message)
    } finally {
      setIsUploading(false)
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

  const retryAllFailed = async () => {
    const failed = materials.filter(
      (m) => !m.processed && !processingIds.has(m.id)
    )
    if (failed.length === 0) return

    const ids = failed.map((m) => m.id)
    setRetryingIds(new Set(ids))

    const results = await Promise.allSettled(
      failed.map((m) =>
        apiClient.post<{ material: Material }>(
          "/api/knowledge/process-material",
          { material_id: m.id }
        )
      )
    )

    let success = 0
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled") {
        success++
        const val = (
          results[i] as PromiseFulfilledResult<{ material: Material }>
        ).value
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === val.material.id ? { ...m, ...val.material } : m
          )
        )
      }
    }

    setRetryingIds(new Set())
    if (success === failed.length)
      toast.success(`All ${success} material(s) analyzed`)
    else
      toast.error(
        `${success}/${failed.length} succeeded. Retry remaining ones.`
      )
  }

  const requestDeleteMaterial = (material: Material) => {
    if (!canEdit) return
    setPendingDelete(material)
  }

  const confirmDeleteMaterial = async () => {
    const material = pendingDelete
    if (!material || !classSubjectId) return
    setPendingDelete(null)

    setDeletingIds((prev) => new Set(prev).add(material.id))
    try {
      const res = await apiClient.delete<{ storage_warning?: string | null }>(
        `/api/knowledge/material/${material.id}/class-subject/${classSubjectId}`
      )
      setMaterials((prev) => prev.filter((m) => m.id !== material.id))
      if (res?.storage_warning) {
        toast.warning(res.storage_warning)
      } else {
        toast.success("Removed from this class")
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove material"
      )
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(material.id)
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
    // If this view's class_subject is no longer in the linked list AND it's not
    // the primary one either, remove the card locally. Backend authoritative.
    if (classSubjectId && !linkedIds.includes(classSubjectId)) {
      setMaterials((prev) =>
        prev.filter(
          (m) => m.id !== materialId || m.class_subject_id === classSubjectId
        )
      )
    }
    if (classSubjectId) fetchMaterials(classSubjectId)
  }

  if (!user) return null

  if (!classSubjectId) {
    return (
      <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 p-8">
        <BookOpenIcon className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Select a class from the sidebar
        </p>
      </div>
    )
  }

  const failedCount = materials.filter(
    (m) => !m.processed && !processingIds.has(m.id) && !retryingIds.has(m.id)
  ).length

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "@container flex min-h-full flex-col gap-5 pb-12"
      )}
    >
      <ClassPageHeader
        icon={BookOpenIcon}
        title="Knowledge"
        count={materials.length || undefined}
        description="What Hint reads to write papers and answer questions for this class."
        actions={
          canEdit ? (
            <Button
              size="lg"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <CircleNotchIcon className="size-3.5 animate-spin" />
              ) : (
                <UploadIcon className="size-3.5" />
              )}
              {isUploading ? "Processing…" : "Add sources"}
            </Button>
          ) : null
        }
      />

      {canEdit && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          onChange={handleFilesSelected}
          className="hidden"
        />
      )}

      {/* ── Failed-analysis strip ── */}
      {canEdit && failedCount > 0 && !isUploading && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/40">
          <ArrowsClockwiseIcon
            className={cn(
              "size-4 shrink-0 text-amber-600 dark:text-amber-400",
              retryingIds.size > 0 && "animate-spin"
            )}
          />
          <p className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-200">
            {failedCount} source{failedCount === 1 ? "" : "s"} couldn't be
            analyzed
          </p>
          <button
            disabled={retryingIds.size > 0}
            onClick={retryAllFailed}
            className="text-sm font-medium text-amber-800 transition-colors hover:text-amber-900 disabled:opacity-50 dark:text-amber-300 dark:hover:text-amber-200"
          >
            Retry all
          </button>
        </div>
      )}

      {/* ── Staging area — files picked but not yet uploaded ── */}
      {canEdit && selectedFiles.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">
            Ready to upload ({selectedFiles.length})
          </p>
          <div className="flex flex-col gap-2">
            {selectedFiles.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
              >
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <Input
                    value={entry.title}
                    onChange={(e) => updateFileTitle(idx, e.target.value)}
                    placeholder="File title"
                    className="h-6 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                  />
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.file.name}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {shareOptions.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                  >
                    <UsersIcon className="size-3.5" />
                    {extraClassSubjectIds.length > 0
                      ? `Also adding to ${extraClassSubjectIds.length} other class${extraClassSubjectIds.length === 1 ? "" : "es"}`
                      : "Also add to other classes"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="text-xs font-medium">
                        Share to other sections
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Same file becomes visible in the picked class-subjects.
                      </p>
                    </div>
                    <ClassSubjectMultiSelect
                      options={shareOptions}
                      value={extraClassSubjectIds}
                      onChange={setExtraClassSubjectIds}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                Add more
              </Button>
              <Button
                onClick={handleUploadAndProcess}
                disabled={
                  isUploading || selectedFiles.some((f) => !f.title.trim())
                }
                size="sm"
              >
                {isUploading
                  ? "Uploading..."
                  : `Upload ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sources ── */}
      <LoadingSwap
        loading={isLoadingMaterials}
        skeleton={<MaterialListSkeleton grouped={false} rows={6} />}
        className="flex-1"
      >
        {materials.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5">
            <Sticker name="point" size={120} />
            <div className="flex max-w-[380px] flex-col items-center gap-1 text-center">
              <p className="text-base font-medium text-secondary-foreground">
                Nothing for Hint to read yet
              </p>
              <p className="text-sm text-muted-foreground">
                {canEdit
                  ? "Upload the textbook or your notes. Every paper and answer for this class starts here. PDF or images, up to 50 MB each."
                  : "No sources have been added for this class yet."}
              </p>
            </div>
            {canEdit && (
              <Button onClick={() => fileInputRef.current?.click()}>
                <UploadIcon className="size-3.5" />
                Add sources
              </Button>
            )}
          </div>
        ) : (
          <MaterialList
            meta={
              <>
                <span className="tabular-nums">
                  {materials.length}{" "}
                  {materials.length === 1 ? "source" : "sources"}
                </span>
                <span className="ml-auto">Newest first</span>
              </>
            }
          >
            <div className="-mx-3 flex flex-col">
              {materials.map((m) => {
                const Icon = getFileIcon(m.file_url)
                const otherLinks = m.linked_class_subject_ids.filter(
                  (id) => id !== classSubjectId
                )
                const tags = m.tags ?? []
                const subtitle = [
                  otherLinks.length > 0
                    ? `also in ${otherLinks.map(primaryLabel).join(", ")}`
                    : null,
                  tags.join(", ") || null,
                ]
                  .filter(Boolean)
                  .join(" · ")
                const busy = processingIds.has(m.id) || retryingIds.has(m.id)
                return (
                  <MaterialRow
                    key={m.id}
                    icon={Icon}
                    iconTitle={
                      m.file_url.toLowerCase().endsWith(".pdf") ? "PDF" : "File"
                    }
                    title={m.title}
                    subtitle={subtitle || undefined}
                    onOpen={() => window.open(m.file_url, "_blank", "noopener")}
                    right={
                      <>
                        <span className="flex w-24 items-center gap-1.5">
                          {m.processed ? (
                            <>
                              <CheckCircleIcon
                                weight="fill"
                                className="size-4 text-emerald-500"
                              />
                              Ready
                            </>
                          ) : busy ? (
                            <>
                              <CircleNotchIcon className="size-4 animate-spin text-violet-500" />
                              Analyzing
                            </>
                          ) : canEdit ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => retryProcessing(m.id)}
                                  className="flex items-center gap-1.5 text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400"
                                >
                                  <ArrowsClockwiseIcon className="size-4" />
                                  Retry
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Analysis failed — click to retry
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">
                              Not ready
                            </span>
                          )}
                        </span>
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
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={deletingIds.has(m.id)}
                                onSelect={() => requestDeleteMaterial(m)}
                              >
                                <TrashIcon className="size-3.5" />
                                Remove from this class
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </>
                    }
                  />
                )
              })}
            </div>
          </MaterialList>
        )}
      </LoadingSwap>

      <MaterialLinksDialog
        open={!!editLinksFor}
        onOpenChange={(o) => !o && setEditLinksFor(null)}
        material={editLinksFor}
        options={allLinkOptions}
        primaryLabel={primaryLabel}
        onSaved={handleLinksSaved}
      />

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from this class?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {pendingDelete?.title ?? ""}
              </span>{" "}
              will be removed from this class only. Your other classes and any
              teacher who picked it from the knowledge bank keep it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMaterial}
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
