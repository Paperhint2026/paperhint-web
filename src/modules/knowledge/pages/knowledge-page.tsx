import { useCallback, useEffect, useRef, useState } from "react"
import {
  BookOpenIcon,
  BrainCircuitIcon,
  FileIcon,
  FileTextIcon,
  HashIcon,
  ImageIcon,
  Loader2Icon,
  MessageSquareIcon,
  PaperclipIcon,
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

export function KnowledgePage() {
  const { user } = useAuth()

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeTab, setActiveTab] = useState<string>("")
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true)

  const [materials, setMaterials] = useState<Material[]>([])
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)

  const [title, setTitle] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [processingStep, setProcessingStep] = useState(-1)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isAsking, setIsAsking] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [attachedFiles, setAttachedFiles] = useState<
    { id: string; title: string }[]
  >([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [showChat, setShowChat] = useState(false)

  // Popover state
  const [popoverType, setPopoverType] = useState<"tag" | "file" | null>(null)
  const [popoverSearch, setPopoverSearch] = useState("")

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
      if (a.length > 0) setActiveTab(a[0].class_subject_id)
    } catch (err) {
      console.error("Failed to fetch assignments:", err)
    } finally {
      setIsLoadingAssignments(false)
    }
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
    }
  }, [activeTab, fetchMaterials])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleUploadAndProcess = async () => {
    if (!selectedFile || !title.trim() || !activeTab) return

    setIsUploading(true)
    setProcessingStep(0)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("class_subject_id", activeTab)
      formData.append("title", title.trim())

      const token = localStorage.getItem("access_token")
      const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

      setProcessingStep(0)
      const uploadRes = await fetch(`${BASE_URL}/api/knowledge/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!uploadRes.ok) throw new Error("Upload failed")

      const uploadData = (await uploadRes.json()) as {
        material: Material
      }

      setMaterials((prev) => [uploadData.material, ...prev])

      setProcessingStep(1)
      await new Promise((r) => setTimeout(r, 800))
      setProcessingStep(2)

      const processRes = await apiClient.post<{ material: Material }>(
        "/api/knowledge/process-material",
        { material_id: uploadData.material.id },
      )

      setProcessingStep(3)
      await new Promise((r) => setTimeout(r, 600))

      setMaterials((prev) =>
        prev.map((m) =>
          m.id === processRes.material.id ? processRes.material : m,
        ),
      )

      setTitle("")
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""

      toast.success("Material uploaded and analyzed successfully")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed. Please try again."
      toast.error(message)
    } finally {
      setIsUploading(false)
      setProcessingStep(-1)
    }
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

    setMessages((prev) => [...prev, userMsg, loadingMsg])
    setChatInput("")
    setAttachedFiles([])
    setSelectedTags([])
    setIsAsking(true)

    try {
      const res = await apiClient.post<{
        answer: string
        sources: { id: string; title: string; tags: string[] }[]
      }>("/api/knowledge/ask", {
        query: chatInput.trim(),
        class_subject_id: activeTab,
        tags: currentTags.length > 0 ? currentTags : undefined,
        material_ids:
          currentFileIds.length > 0 ? currentFileIds : undefined,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setChatInput(val)

    const lastChar = val.slice(-1)
    if (lastChar === "/") {
      setPopoverType("tag")
      setPopoverSearch("")
    } else if (lastChar === "@") {
      setPopoverType("file")
      setPopoverSearch("")
    } else if (popoverType) {
      const triggerChar = popoverType === "tag" ? "/" : "@"
      const lastTriggerIdx = val.lastIndexOf(triggerChar)
      if (lastTriggerIdx === -1) {
        setPopoverType(null)
      } else {
        setPopoverSearch(val.slice(lastTriggerIdx + 1))
      }
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && popoverType) {
      setPopoverType(null)
      e.preventDefault()
    }
  }

  const selectTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag])
    }
    const triggerIdx = chatInput.lastIndexOf("/")
    setChatInput(triggerIdx >= 0 ? chatInput.slice(0, triggerIdx) : chatInput)
    setPopoverType(null)
    inputRef.current?.focus()
  }

  const selectFile = (mat: { id: string; title: string }) => {
    if (!attachedFiles.find((f) => f.id === mat.id)) {
      setAttachedFiles((prev) => [...prev, mat])
    }
    const triggerIdx = chatInput.lastIndexOf("@")
    setChatInput(triggerIdx >= 0 ? chatInput.slice(0, triggerIdx) : chatInput)
    setPopoverType(null)
    inputRef.current?.focus()
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-4">
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

          {/* Content */}
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            {/* Materials */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
              {/* Upload */}
              <div className="rounded-xl bg-muted/30 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <UploadIcon className="size-3.5" />
                  Upload Material
                </h3>
                <div className="flex flex-col gap-3">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Material title..."
                    disabled={isUploading}
                    className="h-9 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      className="flex-1 justify-start text-xs"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {selectedFile ? (
                        <FileTextIcon className="size-3.5" />
                      ) : (
                        <UploadIcon className="size-3.5" />
                      )}
                      {selectedFile
                        ? selectedFile.name.length > 18
                          ? selectedFile.name.slice(0, 18) + "..."
                          : selectedFile.name
                        : "Choose File"}
                    </Button>
                    {selectedFile && !isUploading && (
                      <button
                        onClick={() => {
                          setSelectedFile(null)
                          if (fileInputRef.current)
                            fileInputRef.current.value = ""
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={isUploading || !selectedFile || !title.trim()}
                    onClick={handleUploadAndProcess}
                    className="w-full"
                  >
                    {isUploading ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <UploadIcon className="size-3.5" />
                    )}
                    {isUploading ? "Processing..." : "Upload & Analyze"}
                  </Button>
                </div>

                {/* Processing Animation */}
                {isUploading && processingStep >= 0 && (
                  <div className="mt-3 space-y-1.5">
                    {PROCESSING_STEPS.map((step, i) => {
                      const isActive = i === processingStep
                      const isDone = i < processingStep
                      const isPending = i > processingStep
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-xs transition-all duration-500",
                            isActive && "bg-background font-medium text-foreground shadow-sm",
                            isDone && "text-muted-foreground",
                            isPending && "text-muted-foreground/40",
                          )}
                        >
                          {isDone ? (
                            <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : isActive ? (
                            <Loader2Icon className="size-5 animate-spin text-primary" />
                          ) : (
                            <div className="size-5 rounded-full border-2 border-muted" />
                          )}
                          <step.icon
                            className={cn(
                              "size-4",
                              isActive && "animate-pulse text-primary",
                              isDone && "text-emerald-600",
                              isPending && "text-muted-foreground/30",
                            )}
                          />
                          <span>{step.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Materials list */}
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <BookOpenIcon className="size-3.5" />
                  Materials ({materials.length})
                </h3>

                {isLoadingMaterials ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : materials.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8">
                    <BookOpenIcon className="size-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">
                      No materials yet
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {materials.map((m) => {
                      const Icon = getFileIcon(m.file_url)
                      const isProcessed = !!m.tags && m.tags.length > 0
                      return (
                        <div
                          key={m.id}
                          className="flex flex-col gap-2 rounded-lg border bg-background p-3"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                              <Icon className="size-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">
                                {m.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(m.uploaded_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                isProcessed
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                              )}
                            >
                              {isProcessed ? (
                                <SparklesIcon className="size-2.5" />
                              ) : (
                                <Loader2Icon className="size-2.5 animate-spin" />
                              )}
                              {isProcessed ? "Ready" : "..."}
                            </span>
                          </div>
                          {m.tags && m.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {m.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
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
            </div>

            {/* Floating toggle button */}
            <button
              onClick={() => setShowChat(true)}
              className={cn(
                "fixed bottom-6 right-6 z-20 flex items-center gap-2.5 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-all duration-300",
                showChat
                  ? "pointer-events-none scale-75 opacity-0"
                  : "scale-100 opacity-100 hover:scale-105 hover:shadow-xl active:scale-95",
              )}
            >
              <SparklesIcon className="size-4" />
              Ask PaperHint AI
            </button>

            {/* Chat overlay */}
            <div
              className={cn(
                "fixed bottom-6 right-6 z-30 flex flex-col overflow-hidden rounded-xl border bg-background shadow-2xl transition-all duration-300 ease-in-out origin-bottom-right",
                showChat
                  ? "h-[calc(100vh-120px)] w-[600px] scale-100 opacity-100"
                  : "pointer-events-none h-0 w-0 scale-50 opacity-0",
              )}
            >
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b px-5 py-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <SparklesIcon className="size-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold">PaperHint AI</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Ask questions about your uploaded materials
                  </p>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              {/* Hint bar */}
              <div className="flex items-center gap-3 border-b px-5 py-1.5">
                <span className="text-[10px] text-muted-foreground">
                  Type <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">/</kbd> for tags
                  {" · "}
                  <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">@</kbd> to attach files
                </span>
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

              {/* Chat input */}
              <div className="border-t px-4 py-3">
                {/* Attached chips */}
                {(selectedTags.length > 0 || attachedFiles.length > 0) && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {attachedFiles.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400"
                      >
                        <PaperclipIcon className="size-3" />
                        {f.title}
                        <button
                          onClick={() =>
                            setAttachedFiles((prev) =>
                              prev.filter((x) => x.id !== f.id),
                            )
                          }
                          className="ml-0.5 rounded-full hover:bg-blue-500/20"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-400"
                      >
                        <HashIcon className="size-3" />
                        {tag}
                        <button
                          onClick={() =>
                            setSelectedTags((prev) =>
                              prev.filter((t) => t !== tag),
                            )
                          }
                          className="ml-0.5 rounded-full hover:bg-purple-500/20"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Popover */}
                <div className="relative">
                  {popoverType && (
                    <div className="absolute bottom-full left-0 z-10 mb-2 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg">
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                        {popoverType === "tag"
                          ? "Select a tag"
                          : "Attach a file"}
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {popoverType === "tag" ? (
                          allTags.length === 0 ? (
                            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                              No tags available
                            </p>
                          ) : (
                            allTags
                              .filter((t) =>
                                t
                                  .toLowerCase()
                                  .includes(popoverSearch.toLowerCase()),
                              )
                              .map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => selectTag(tag)}
                                  className={cn(
                                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                                    selectedTags.includes(tag) &&
                                      "bg-primary/5 text-primary",
                                  )}
                                >
                                  <HashIcon className="size-3.5 text-purple-500" />
                                  {tag}
                                  {selectedTags.includes(tag) && (
                                    <span className="ml-auto text-[10px] text-primary">
                                      added
                                    </span>
                                  )}
                                </button>
                              ))
                          )
                        ) : analyzedMaterials.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                            No analyzed files available
                          </p>
                        ) : (
                          analyzedMaterials
                            .filter((m) =>
                              m.title
                                .toLowerCase()
                                .includes(popoverSearch.toLowerCase()),
                            )
                            .map((m) => (
                              <button
                                key={m.id}
                                onClick={() =>
                                  selectFile({
                                    id: m.id,
                                    title: m.title,
                                  })
                                }
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                                  attachedFiles.find(
                                    (f) => f.id === m.id,
                                  ) && "bg-primary/5 text-primary",
                                )}
                              >
                                <FileTextIcon className="size-3.5 text-blue-500" />
                                <span className="truncate">{m.title}</span>
                                {attachedFiles.find(
                                  (f) => f.id === m.id,
                                ) && (
                                  <span className="ml-auto shrink-0 text-[10px] text-primary">
                                    attached
                                  </span>
                                )}
                              </button>
                            ))
                        )}
                      </div>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      handleAsk()
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      ref={inputRef}
                      value={chatInput}
                      onChange={handleInputChange}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Ask about your materials... (/ for tags, @ for files)"
                      disabled={isAsking}
                      className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={isAsking || !chatInput.trim()}
                    >
                      {isAsking ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        <SendIcon className="size-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
