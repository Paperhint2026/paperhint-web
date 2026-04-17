import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  BookOpenIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  RefreshCwIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"

import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Material {
  id: string
  class_subject_id: string
  teacher_id: string
  title: string
  file_url: string
  tags?: string[] | null
  processed?: boolean
  uploaded_at: string
}

function getFileIcon(url: string) {
  const lower = url.toLowerCase()
  if (lower.endsWith(".pdf")) return FileTextIcon
  if (/\.(jpe?g|png|webp|gif|svg)/.test(lower)) return ImageIcon
  return FileIcon
}

export function KnowledgePage() {
  const { user } = useAuth()
  const { classSubjectId } = useParams<{ classSubjectId: string }>()

  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)

  const [selectedFiles, setSelectedFiles] = useState<{ file: File; title: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

  const fetchMaterials = useCallback(async (classSubjectId: string) => {
    setIsLoadingMaterials(true)
    try {
      const res = await apiClient.get<{ materials: Material[] }>(
        `/api/knowledge/materials/${classSubjectId}`,
      )
      setMaterials(res.materials ?? [])
    } catch (err) {
      console.error("Failed to fetch materials:", err)
      setMaterials([])
    } finally {
      setIsLoadingMaterials(false)
    }
  }, [])

  useEffect(() => {
    if (classSubjectId) {
      fetchMaterials(classSubjectId)
    }
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
      toast.error(`Skipped ${skipped.length} file(s) exceeding 50MB: ${skipped.join(", ")}`)
    }

    setSelectedFiles((prev) => [...prev, ...newEntries])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const updateFileTitle = (idx: number, title: string) => {
    setSelectedFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, title } : f)))
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
      formData.append("titles", JSON.stringify(selectedFiles.map((f) => f.title.trim())))
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

      const processResults = await Promise.allSettled(
        uploaded.map((mat) =>
          apiClient.post<{ material: Material }>(
            "/api/knowledge/process-material",
            { material_id: mat.id },
          ),
        ),
      )

      let successCount = 0
      for (let i = 0; i < processResults.length; i++) {
        const result = processResults[i]
        if (result.status === "fulfilled") {
          successCount++
          setMaterials((prev) =>
            prev.map((m) => (m.id === result.value.material.id ? result.value.material : m)),
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
      const message = err instanceof Error ? err.message : "Upload failed. Please try again."
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
        { material_id: materialId },
      )
      setMaterials((prev) =>
        prev.map((m) => (m.id === res.material.id ? res.material : m)),
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
    const failed = materials.filter((m) => !m.processed && !processingIds.has(m.id))
    if (failed.length === 0) return

    const ids = failed.map((m) => m.id)
    setRetryingIds(new Set(ids))

    const results = await Promise.allSettled(
      failed.map((m) =>
        apiClient.post<{ material: Material }>(
          "/api/knowledge/process-material",
          { material_id: m.id },
        ),
      ),
    )

    let success = 0
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled") {
        success++
        const val = (results[i] as PromiseFulfilledResult<{ material: Material }>).value
        setMaterials((prev) =>
          prev.map((m) => (m.id === val.material.id ? val.material : m)),
        )
      }
    }

    setRetryingIds(new Set())
    if (success === failed.length) toast.success(`All ${success} material(s) analyzed`)
    else toast.error(`${success}/${failed.length} succeeded. Retry remaining ones.`)
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* ── Sources panel ── */}
          <div className="flex w-full flex-col">
            {/* Fixed header: upload area */}
            <div className="shrink-0 border-b p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <BookOpenIcon className="size-3.5" />
                  Sources ({materials.length})
                </h3>
                {(() => {
                  const failedCount = materials.filter((m) => !m.processed && !processingIds.has(m.id) && !retryingIds.has(m.id)).length
                  return failedCount > 0 && !isUploading ? (
                    <button
                      disabled={retryingIds.size > 0}
                      onClick={retryAllFailed}
                      className="flex items-center gap-1 text-[10px] font-medium text-amber-600 transition-colors hover:text-amber-700 disabled:opacity-50 dark:text-amber-400"
                    >
                      <RefreshCwIcon className={cn("size-2.5", retryingIds.size > 0 && "animate-spin")} />
                      Retry {failedCount}
                    </button>
                  ) : null
                })()}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={isUploading}
                className="w-full justify-center gap-1.5 border-dashed text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <UploadIcon className="size-3.5" />
                )}
                {isUploading ? "Processing..." : selectedFiles.length === 0 ? "Add Sources" : "Add More"}
              </Button>
              <p className="mt-1 text-center text-[9px] text-muted-foreground/60">
                PDF, images up to 50 MB
              </p>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={handleFilesSelected}
                className="hidden"
              />

              {selectedFiles.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {selectedFiles.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
                      <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <Input
                          value={entry.title}
                          onChange={(e) => updateFileTitle(idx, e.target.value)}
                          placeholder="File title"
                          className="h-6 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                        />
                        <p className="truncate text-[9px] text-muted-foreground">
                          {entry.file.name}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                  <Button
                    onClick={handleUploadAndProcess}
                    disabled={isUploading || selectedFiles.some((f) => !f.title.trim())}
                    size="sm"
                    className="w-full text-xs"
                  >
                    {isUploading ? "Uploading..." : `Upload ${selectedFiles.length} file(s)`}
                  </Button>
                </div>
              )}

              {materials.length > 0 && (
                <div className="mt-2 space-y-1">
                  {materials.map((m) => {
                    const Icon = getFileIcon(m.file_url)
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "group rounded-lg border bg-background p-2.5 transition-colors hover:bg-muted/30",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Icon className="size-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium leading-tight">
                              {m.title}
                            </p>
                            <p className="text-[9px] leading-tight text-muted-foreground">
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
                          ) : (
                            <button
                              onClick={() => retryProcessing(m.id)}
                              disabled={retryingIds.has(m.id)}
                              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 transition-colors hover:bg-amber-500/25"
                            >
                              <RefreshCwIcon className="size-2.5 text-amber-600 dark:text-amber-400" />
                            </button>
                          )}
                        </div>
                        {m.tags && m.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 pl-9">
                            {m.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-muted px-1.5 py-0.5 text-[9px] leading-none text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {isLoadingMaterials ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : materials.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <BookOpenIcon className="size-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">
                    No sources yet. Upload a file to get started.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
