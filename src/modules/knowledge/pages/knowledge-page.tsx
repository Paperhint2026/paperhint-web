import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  BookOpenIcon,
  BrainCircuitIcon,
  ChevronDownIcon,
  FileIcon,
  FileTextIcon,
  HashIcon,
  InfoIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquareIcon,
  PaperclipIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Assignment {
  class_subject_id: string
  class: { id: string; grade: number; section: string } | null
  subject: { id: string; subject_name: string } | null
}

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

interface TeacherOverview {
  assignments: Assignment[]
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: { id: string; title: string; tags: string[] }[]
  isLoading?: boolean
}

const PROCESSING_STEPS = [
  { label: "Uploading file...", icon: UploadIcon },
  { label: "Reading document content...", icon: FileTextIcon },
  { label: "Extracting key information...", icon: BrainCircuitIcon },
  { label: "Generating tags & embeddings...", icon: SparklesIcon },
]

function getFileIcon(url: string) {
  const lower = url.toLowerCase()
  if (lower.endsWith(".pdf")) return FileTextIcon
  if (/\.(jpe?g|png|webp|gif|svg)/.test(lower)) return ImageIcon
  return FileIcon
}

function tagsScopeKey(tags: string[]) {
  return [...tags].sort().join("\0")
}

function fileIdsScopeKey(ids: string[]) {
  return [...ids].sort().join("\0")
}

export function KnowledgePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, _setActiveTab] = useState<string>("")
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true)

  const setActiveTab = useCallback(
    (classSubjectId: string, assignmentsList?: Assignment[]) => {
      _setActiveTab(classSubjectId)
      const list = assignmentsList ?? assignments
      const match = list.find((a) => a.class_subject_id === classSubjectId)
      if (match?.class && match?.subject) {
        const label = `${match.class.grade}${match.class.section}-${match.subject.subject_name}`.replace(/\s+/g, "-")
        setSearchParams({ class: label }, { replace: true })
      }
    },
    [assignments, setSearchParams],
  )

  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)

  const [selectedFiles, setSelectedFiles] = useState<{ file: File; title: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [processingStep, setProcessingStep] = useState(-1)
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isAsking, setIsAsking] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [attachedFiles, setAttachedFiles] = useState<
    { id: string; title: string }[]
  >([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  /** Last successful ask — used to detect topic / attachment scope changes */
  const lastAskTagsRef = useRef<string[]>([])
  const lastAskFileIdsRef = useRef<string[]>([])

  const [showChat, setShowChat] = useState(true)

  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false)
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false)
  const [topicSearch, setTopicSearch] = useState("")
  const [fileSearch, setFileSearch] = useState("")

  const allTags = Array.from(
    new Set(materials.flatMap((m) => m.tags ?? [])),
  )

  const analyzedMaterials = materials.filter(
    (m) => m.tags && m.tags.length > 0,
  )

  const fetchAssignments = useCallback(async () => {
    if (!user) return
    setIsLoadingAssignments(true)
    try {
      const res = await apiClient.get<{ teacher: TeacherOverview }>(
        `/api/auth/teacher/${user.id}/overview`,
      )
      const a = res.teacher.assignments ?? []
      setAssignments(a)

      if (a.length > 0) {
        const classParam = searchParams.get("class")
        let restored = false
        if (classParam) {
          const match = a.find((asn) => {
            if (!asn.class || !asn.subject) return false
            const label = `${asn.class.grade}${asn.class.section}-${asn.subject.subject_name}`.replace(/\s+/g, "-")
            return label === classParam
          })
          if (match) {
            setActiveTab(match.class_subject_id, a)
            restored = true
          }
        }
        if (!restored) {
          setActiveTab(a[0].class_subject_id, a)
        }
      }
    } catch (err) {
      console.error("Failed to fetch assignments:", err)
    } finally {
      setIsLoadingAssignments(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

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
    fetchAssignments()
  }, [fetchAssignments])

  useEffect(() => {
    if (activeTab) {
      fetchMaterials(activeTab)
      setMessages([])
      setSelectedTags([])
      setAttachedFiles([])
      lastAskTagsRef.current = []
      lastAskFileIdsRef.current = []
    }
  }, [activeTab, fetchMaterials])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
    if (selectedFiles.length === 0 || !activeTab) return
    if (selectedFiles.some((f) => !f.title.trim())) {
      return toast.error("All files need a title")
    }

    setIsUploading(true)
    setProcessingStep(0)

    try {
      const formData = new FormData()
      formData.append("class_subject_id", activeTab)
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
      setProcessingStep(2)

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
      setProcessingStep(3)
      await new Promise((r) => setTimeout(r, 400))

      toast.success(`${successCount} material(s) uploaded and analyzed`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed. Please try again."
      toast.error(message)
    } finally {
      setIsUploading(false)
      setProcessingStep(-1)
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

  const handleAsk = async () => {
    if (!chatInput.trim() || isAsking) return

    const displayParts: string[] = []
    if (attachedFiles.length > 0)
      displayParts.push(
        attachedFiles.map((f) => `@${f.title}`).join(" "),
      )
    if (selectedTags.length > 0)
      displayParts.push(selectedTags.map((t) => `/${t}`).join(" "))
    const displayContent = [
      ...displayParts,
      chatInput.trim(),
    ].join(" ")

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: displayContent,
    }

    const loadingMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isLoading: true,
    }

    const currentTags = [...selectedTags]
    const currentFileIds = attachedFiles.map((f) => f.id)

    const completedPrior = messages.filter(
      (m): m is ChatMessage => !m.isLoading && Boolean(m.content),
    )

    const topicTagsChanged =
      currentTags.length > 0 &&
      tagsScopeKey(currentTags) !== tagsScopeKey(lastAskTagsRef.current)

    const pinnedFilesChanged =
      currentFileIds.length > 0 &&
      fileIdsScopeKey(currentFileIds) !== fileIdsScopeKey(lastAskFileIdsRef.current)

    const omitHistoryForNewScope = topicTagsChanged || pinnedFilesChanged

    const conversation_history = omitHistoryForNewScope
      ? []
      : completedPrior.map((m) => ({
          role: m.role,
          content: m.content,
        }))

    const lastAssistantWithSources = [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === "assistant" &&
          !m.isLoading &&
          m.sources &&
          m.sources.length > 0,
      )

    const usePriorAnswerSources =
      currentFileIds.length === 0 && currentTags.length === 0

    const fallbackMaterialIds = usePriorAnswerSources
      ? (lastAssistantWithSources?.sources?.map((s) => s.id) ?? [])
      : []

    const material_ids =
      currentFileIds.length > 0
        ? currentFileIds
        : fallbackMaterialIds.length > 0
          ? [...new Set(fallbackMaterialIds)]
          : undefined

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setChatInput("")
    setAttachedFiles([])
    setSelectedTags([])
    setIsAsking(true)
    if (inputRef.current) inputRef.current.style.height = "auto"

    try {
      const res = await apiClient.post<{
        answer: string
        sources: { id: string; title: string; tags: string[] }[]
      }>("/api/knowledge/ask", {
        query: chatInput.trim(),
        class_subject_id: activeTab,
        tags: currentTags.length > 0 ? currentTags : undefined,
        material_ids,
        ...(conversation_history.length > 0
          ? { conversation_history }
          : {}),
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: res.answer,
                sources: res.sources,
                isLoading: false,
              }
            : m,
        ),
      )
      lastAskTagsRef.current = [...currentTags]
      lastAskFileIdsRef.current = [...currentFileIds]
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to get a response"
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: `Error: ${errMsg}`, isLoading: false }
            : m,
        ),
      )
      toast.error(errMsg)
    } finally {
      setIsAsking(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 72)}px`
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const toggleFile = (mat: { id: string; title: string }) => {
    setAttachedFiles((prev) =>
      prev.find((f) => f.id === mat.id)
        ? prev.filter((f) => f.id !== mat.id)
        : [...prev, mat],
    )
  }


  if (!user) return null

  return (
    <div className="flex size-full flex-col overflow-hidden">
      {isLoadingAssignments ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
          <BookOpenIcon className="size-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No class-subject assignments found. Contact your admin to get
            assigned.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none">
            {assignments.map((a) => (
              <button
                key={a.class_subject_id}
                onClick={() => setActiveTab(a.class_subject_id)}
                className={cn(
                  "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === a.class_subject_id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                Grade {a.class?.grade} – {a.class?.section} ·{" "}
                {a.subject?.subject_name}
              </button>
            ))}
          </div>

          {/* Content — NotebookLM-style split layout */}
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            {/* ── Sources panel (left) ── */}
            <div className="flex w-full flex-col md:w-auto md:flex-[2] md:border-r">
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
                  PDF, JPEG, PNG, WebP — max 50 MB per file
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  multiple
                  onChange={handleFilesSelected}
                />

                {/* Staged files for upload */}
                {selectedFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {selectedFiles.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
                        <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <Input
                            value={entry.title}
                            onChange={(e) => updateFileTitle(idx, e.target.value)}
                            disabled={isUploading}
                            className="h-6 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                            placeholder="Title..."
                          />
                          <p className="truncate text-[9px] text-muted-foreground">
                            {entry.file.name} · {(entry.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                        {!isUploading && (
                          <button
                            onClick={() => removeFile(idx)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                          >
                            <XIcon className="size-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    <Button
                      size="sm"
                      disabled={isUploading || selectedFiles.some((f) => !f.title.trim())}
                      onClick={handleUploadAndProcess}
                      className="w-full text-xs"
                    >
                      Upload & Analyze ({selectedFiles.length})
                    </Button>
                  </div>
                )}

                {/* Processing steps */}
                {isUploading && processingStep >= 0 && (
                  <div className="mt-2 space-y-1">
                    {PROCESSING_STEPS.map((step, i) => {
                      const isActive = i === processingStep
                      const isDone = i < processingStep
                      const isPending = i > processingStep
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-2 rounded px-2 py-1 text-[10px] transition-all duration-500",
                            isActive && "bg-background font-medium text-foreground shadow-sm",
                            isDone && "text-muted-foreground",
                            isPending && "text-muted-foreground/40",
                          )}
                        >
                          {isDone ? (
                            <div className="flex size-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                              <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : isActive ? (
                            <Loader2Icon className="size-4 animate-spin text-primary" />
                          ) : (
                            <div className="size-4 rounded-full border border-muted" />
                          )}
                          <span>{step.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Scrollable materials list */}
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {isLoadingMaterials ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : materials.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <BookOpenIcon className="size-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">
                      Upload PDFs or images to get started
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {materials.map((m) => {
                      const Icon = getFileIcon(m.file_url)
                      const isProcessed = !!m.processed
                      const isActivelyProcessing = processingIds.has(m.id) || retryingIds.has(m.id)
                      const isFailed = !isProcessed && !isActivelyProcessing
                      return (
                        <div
                          key={m.id}
                          className="group rounded-lg border bg-background p-2.5 transition-colors hover:bg-muted/30"
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
                                {new Date(m.uploaded_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            {isProcessed ? (
                              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                                <SparklesIcon className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                              </span>
                            ) : isActivelyProcessing ? (
                              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
                                <Loader2Icon className="size-2.5 animate-spin text-blue-600 dark:text-blue-400" />
                              </span>
                            ) : isFailed ? (
                              <button
                                onClick={() => retryProcessing(m.id)}
                                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 transition-colors hover:bg-amber-500/25"
                              >
                                <RefreshCwIcon className="size-2.5 text-amber-600 dark:text-amber-400" />
                              </button>
                            ) : null}
                          </div>
                          {m.tags && m.tags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1 pl-9">
                              {m.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-muted px-1.5 py-0.5 text-[9px] leading-none text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                              {m.tags.length > 3 && (
                                <span className="text-[9px] leading-none text-muted-foreground">
                                  +{m.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Mobile FAB ── */}
            <button
              onClick={() => setShowChat(true)}
              className={cn(
                "fixed bottom-6 right-6 z-20 flex items-center gap-2.5 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-all duration-300 md:hidden",
                showChat
                  ? "pointer-events-none scale-75 opacity-0"
                  : "scale-100 opacity-100 active:scale-95",
              )}
            >
              <SparklesIcon className="size-4" />
              Ask AI
            </button>

            {/* ── Chat panel (right) ── */}
            <div
              className={cn(
                "flex flex-col overflow-hidden bg-background",
                "fixed inset-0 z-30 transition-transform duration-300 ease-in-out",
                "md:relative md:inset-auto md:z-auto md:translate-x-0 md:flex-[3] md:transition-none",
                showChat ? "translate-x-0" : "pointer-events-none translate-x-full md:pointer-events-auto md:translate-x-0",
              )}
            >
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b px-5 py-3">
                {/* Mobile-only back button */}
                <button
                  onClick={() => setShowChat(false)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
                >
                  <XIcon className="size-4" />
                </button>
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <SparklesIcon className="size-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">PaperHint AI</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Ask questions about your uploaded materials
                  </p>
                </div>
              </div>

              {/* Chat messages */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/5">
                      <MessageSquareIcon className="size-8 text-primary/40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Ask anything about your materials
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground/60">
                        Prepare notes, research topics, get summaries, create
                        lesson plans — all from your uploaded content.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        "Summarize the key concepts",
                        "Create a lesson plan",
                        "What are the important formulas?",
                        "Prepare quiz questions",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setChatInput(q)
                          }}
                          className="rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-3",
                          msg.role === "user" && "justify-end",
                        )}
                      >
                        {msg.role === "assistant" && (
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <SparklesIcon className="size-3.5 text-primary" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "rounded-xl px-4 py-3 text-sm",
                            msg.role === "user"
                              ? "max-w-[75%] bg-primary text-primary-foreground"
                              : "max-w-[90%] bg-muted/40",
                          )}
                        >
                          {msg.isLoading ? (
                            <div className="flex items-center gap-2 py-1">
                              <div className="flex gap-1">
                                <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
                                <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
                                <span className="size-2 animate-bounce rounded-full bg-primary/60" />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Thinking...
                              </span>
                            </div>
                          ) : msg.role === "assistant" ? (
                            <div className="ai-response max-w-none text-sm leading-relaxed">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath, remarkGfm]}
                                rehypePlugins={[rehypeRaw, rehypeKatex]}
                                components={{
                                  h1: ({ children }) => (
                                    <h1 className="mb-3 mt-5 text-lg font-bold first:mt-0">{children}</h1>
                                  ),
                                  h2: ({ children }) => (
                                    <h2 className="mb-2 mt-5 text-base font-bold first:mt-0">{children}</h2>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="mb-2 mt-4 text-sm font-bold first:mt-0">{children}</h3>
                                  ),
                                  p: ({ children }) => (
                                    <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="mb-3 ml-1 list-inside list-disc space-y-1.5 last:mb-0">{children}</ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="mb-3 ml-1 list-inside list-decimal space-y-1.5 last:mb-0">{children}</ol>
                                  ),
                                  li: ({ children }) => (
                                    <li className="leading-relaxed">{children}</li>
                                  ),
                                  strong: ({ children }) => (
                                    <strong className="font-semibold text-foreground">{children}</strong>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="my-3 border-l-3 border-primary/40 bg-primary/5 py-2 pl-4 pr-3 text-sm italic text-muted-foreground [&_p]:mb-0">
                                      {children}
                                    </blockquote>
                                  ),
                                  hr: () => (
                                    <hr className="my-4 border-border/60" />
                                  ),
                                  table: ({ children }) => (
                                    <div className="my-3 overflow-x-auto rounded-lg border">
                                      <table className="w-full text-left text-sm">{children}</table>
                                    </div>
                                  ),
                                  thead: ({ children }) => (
                                    <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</thead>
                                  ),
                                  th: ({ children }) => (
                                    <th className="whitespace-nowrap px-3 py-2.5">{children}</th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="border-t px-3 py-2">{children}</td>
                                  ),
                                  tr: ({ children }) => (
                                    <tr className="transition-colors hover:bg-muted/30">{children}</tr>
                                  ),
                                  code: ({ children, className }) => {
                                    const isBlock = className?.includes("language-")
                                    if (isBlock) {
                                      return (
                                        <pre className="my-3 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100 dark:bg-zinc-900">
                                          <code>{children}</code>
                                        </pre>
                                      )
                                    }
                                    return (
                                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{children}</code>
                                    )
                                  },
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <p>{msg.content}</p>
                          )}

                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 border-t border-border/50 pt-2">
                              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Sources
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {msg.sources.map((s) => (
                                  <span
                                    key={s.id}
                                    className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground shadow-sm"
                                  >
                                    <FileTextIcon className="size-2.5" />
                                    {s.title}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Chat input area */}
              <div className="border-t px-4 py-3">
                <div
                  className="rounded-2xl border border-input bg-background ring-ring transition-shadow focus-within:ring-2"
                  onClick={() => inputRef.current?.focus()}
                >
                  {/* Selected chips row */}
                  {(selectedTags.length > 0 || attachedFiles.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 px-3.5 pt-3">
                      {attachedFiles.map((f) => (
                        <span
                          key={f.id}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400"
                        >
                          <PaperclipIcon className="size-2.5" />
                          {f.title}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setAttachedFiles((prev) => prev.filter((x) => x.id !== f.id))
                            }}
                            className="ml-0.5 rounded-full hover:bg-blue-500/20"
                          >
                            <XIcon className="size-2.5" />
                          </button>
                        </span>
                      ))}
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-400"
                        >
                          <HashIcon className="size-2.5" />
                          {tag}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTags((prev) => prev.filter((t) => t !== tag))
                            }}
                            className="ml-0.5 rounded-full hover:bg-purple-500/20"
                          >
                            <XIcon className="size-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    ref={inputRef}
                    value={chatInput}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Ask about your materials…"
                    disabled={isAsking}
                    rows={1}
                    className="max-h-[72px] min-h-[36px] w-full resize-none bg-transparent px-3.5 pt-3 text-sm leading-snug outline-none placeholder:text-muted-foreground"
                  />

                  {/* Bottom bar: pills + send */}
                  <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
                    {/* Topics pill */}
                    <Popover
                      open={topicDropdownOpen}
                      onOpenChange={(open) => {
                        setTopicDropdownOpen(open)
                        if (open) {
                          setFileDropdownOpen(false)
                          setTopicSearch("")
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                            selectedTags.length > 0
                              ? "bg-purple-500/15 text-purple-700 dark:text-purple-400"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                          )}
                        >
                          <HashIcon className="size-3" />
                          {selectedTags.length > 0
                            ? `${selectedTags.length} topic${selectedTags.length > 1 ? "s" : ""}`
                            : "Topics"}
                          <ChevronDownIcon className={cn("size-3 transition-transform", topicDropdownOpen && "rotate-180")} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="top"
                        align="start"
                        sideOffset={8}
                        className="w-64 gap-0 p-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onCloseAutoFocus={(e) => e.preventDefault()}
                        onFocusOutside={(e) => e.preventDefault()}
                        onPointerDownOutside={(e) => {
                          const target = e.target as HTMLElement
                          if (target.closest("[data-slot='popover-trigger']")) return
                          setTopicDropdownOpen(false)
                        }}
                        onInteractOutside={(e) => e.preventDefault()}
                      >
                        <div className="flex items-center gap-2 border-b px-3 py-2">
                          <SearchIcon className="size-3.5 text-muted-foreground" />
                          <input
                            autoFocus
                            value={topicSearch}
                            onChange={(e) => setTopicSearch(e.target.value)}
                            placeholder="Search topics…"
                            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto p-1.5">
                          {allTags.length === 0 ? (
                            <p className="py-3 text-center text-[11px] text-muted-foreground">No topics available</p>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {allTags
                                .filter((t) => t.toLowerCase().includes(topicSearch.toLowerCase()))
                                .map((tag) => (
                                  <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                                      selectedTags.includes(tag)
                                        ? "bg-purple-500/10 text-purple-700 dark:text-purple-400"
                                        : "text-foreground hover:bg-muted",
                                    )}
                                  >
                                    <div className={cn(
                                      "flex size-3.5 shrink-0 items-center justify-center rounded border",
                                      selectedTags.includes(tag)
                                        ? "border-purple-500 bg-purple-500 text-white"
                                        : "border-muted-foreground/40",
                                    )}>
                                      {selectedTags.includes(tag) && <span className="text-[8px]">✓</span>}
                                    </div>
                                    {tag}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Files pill */}
                    <Popover
                      open={fileDropdownOpen}
                      onOpenChange={(open) => {
                        setFileDropdownOpen(open)
                        if (open) {
                          setTopicDropdownOpen(false)
                          setFileSearch("")
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                            attachedFiles.length > 0
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                          )}
                        >
                          <PaperclipIcon className="size-3" />
                          {attachedFiles.length > 0
                            ? `${attachedFiles.length} file${attachedFiles.length > 1 ? "s" : ""}`
                            : "Sources"}
                          <ChevronDownIcon className={cn("size-3 transition-transform", fileDropdownOpen && "rotate-180")} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="top"
                        align="start"
                        sideOffset={8}
                        className="w-72 gap-0 p-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onCloseAutoFocus={(e) => e.preventDefault()}
                        onFocusOutside={(e) => e.preventDefault()}
                        onPointerDownOutside={(e) => {
                          const target = e.target as HTMLElement
                          if (target.closest("[data-slot='popover-trigger']")) return
                          setFileDropdownOpen(false)
                        }}
                        onInteractOutside={(e) => e.preventDefault()}
                      >
                        <div className="flex items-center gap-2 border-b px-3 py-2">
                          <SearchIcon className="size-3.5 text-muted-foreground" />
                          <input
                            autoFocus
                            value={fileSearch}
                            onChange={(e) => setFileSearch(e.target.value)}
                            placeholder="Search files…"
                            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                          />
                        </div>
                        <div className="max-h-44 overflow-y-auto p-1.5">
                          {analyzedMaterials.length === 0 ? (
                            <p className="py-3 text-center text-[11px] text-muted-foreground">No analyzed files</p>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {analyzedMaterials
                                .filter((m) => m.title.toLowerCase().includes(fileSearch.toLowerCase()))
                                .map((m) => (
                                  <button
                                    key={m.id}
                                    onClick={() => toggleFile({ id: m.id, title: m.title })}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                                      attachedFiles.find((f) => f.id === m.id)
                                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                        : "text-foreground hover:bg-muted",
                                    )}
                                  >
                                    <div className={cn(
                                      "flex size-3.5 shrink-0 items-center justify-center rounded border",
                                      attachedFiles.find((f) => f.id === m.id)
                                        ? "border-blue-500 bg-blue-500 text-white"
                                        : "border-muted-foreground/40",
                                    )}>
                                      {attachedFiles.find((f) => f.id === m.id) && <span className="text-[8px]">✓</span>}
                                    </div>
                                    <FileTextIcon className="size-3 shrink-0" />
                                    <span className="truncate">{m.title}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Prompt help"
                          >
                            <InfoIcon className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={8}>
                          Choose topics and sources to focus your answer
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Send button */}
                    <button
                      type="button"
                      disabled={isAsking || !chatInput.trim()}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAsk()
                      }}
                      className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                    >
                      {isAsking ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <SendIcon className="size-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
