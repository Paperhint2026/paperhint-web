import { useCallback, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileTextIcon,
  Loader2Icon,
  ScanTextIcon,
  SearchIcon,
  SparklesIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PROCESSING_STEPS = [
  { label: "Uploading question paper...", icon: UploadCloudIcon },
  { label: "Extracting text from paper...", icon: ScanTextIcon },
  { label: "Identifying questions & sections...", icon: FileTextIcon },
  { label: "Searching knowledge base for answer keys...", icon: SearchIcon },
  { label: "Generating answer keys with AI...", icon: SparklesIcon },
]

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]

export function UploadPaperPage() {
  const { classSubjectId, examId } = useParams<{ classSubjectId: string; examId: string }>()
  const navigate = useNavigate()
  const backUrl = `/class/${classSubjectId}/exams`

  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [isDone, setIsDone] = useState(false)

  const handleFile = useCallback((f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error("Only PDF and image files (PNG, JPG, WebP) are accepted")
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("File size must be under 20 MB")
      return
    }
    setFile(f)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0])
    },
    [handleFile],
  )

  const handleUpload = async () => {
    if (!examId || !file) return
    setIsProcessing(true)
    setCurrentStep(0)
    setIsDone(false)

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= PROCESSING_STEPS.length - 1) {
          clearInterval(stepInterval)
          return prev
        }
        return prev + 1
      })
    }, 4000)

    try {
      const formData = new FormData()
      formData.append("exam_id", examId)
      formData.append("file", file)

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/exams/upload-paper`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
          },
          body: formData,
        },
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Upload failed")
      }

      const data = await res.json()

      clearInterval(stepInterval)
      setCurrentStep(PROCESSING_STEPS.length - 1)
      setIsDone(true)

      const qCount = data.questions?.questions?.length ?? data.questions?.length ?? 0
      toast.success(`${qCount} questions extracted successfully!`)

      setTimeout(() => {
        navigate(`/class/${classSubjectId}/exams/${examId}/questions`)
      }, 2000)
    } catch (err: unknown) {
      clearInterval(stepInterval)
      setIsProcessing(false)
      setCurrentStep(-1)
      toast.error((err as Error).message || "Failed to process paper")
    }
  }

  return (
    <div className="flex min-h-full w-full flex-col">
      {/* Top bar */}
      <div className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <button
          onClick={() => navigate(backUrl)}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back to Exams
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-4 sm:gap-8 sm:p-8">
        {!isProcessing ? (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-sky-500/10">
                <UploadCloudIcon className="size-10 text-sky-600" />
              </div>
              <h1 className="text-2xl font-bold">Upload Question Paper</h1>
              <p className="max-w-md text-sm text-muted-foreground">
                Upload an existing question paper (PDF or image). PaperHint AI
                will extract questions, identify sections, and generate answer
                keys automatically.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => {
                if (!file) {
                  const inp = document.createElement("input")
                  inp.type = "file"
                  inp.accept = ".pdf,.png,.jpg,.jpeg,.webp"
                  inp.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0]
                    if (f) handleFile(f)
                  }
                  inp.click()
                }
              }}
              className={cn(
                "w-full cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all",
                dragActive
                  ? "border-sky-500 bg-sky-50/50 dark:bg-sky-950/20"
                  : file
                    ? "border-sky-300 bg-sky-50/30 dark:border-sky-800 dark:bg-sky-950/10"
                    : "border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/30",
              )}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileTextIcon className="size-8 text-sky-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                    }}
                    className="ml-2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <UploadCloudIcon className="size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop your question paper here, or{" "}
                    <span className="font-medium text-foreground underline underline-offset-4">
                      browse
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    PDF, PNG, JPG, WebP — up to 20 MB
                  </p>
                </div>
              )}
            </div>

            <Button
              size="lg"
              onClick={handleUpload}
              disabled={!file}
              className="w-full max-w-sm"
            >
              <UploadCloudIcon className="mr-2 size-5" />
              Upload & Process
            </Button>
          </>
        ) : (
          <>
            {/* Processing view */}
            <div className="flex flex-col items-center gap-4 text-center">
              {!isDone ? (
                <div className="relative flex size-24 items-center justify-center">
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
                  <ScanTextIcon className="size-10 text-sky-600" />
                </div>
              ) : (
                <div className="flex size-24 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2Icon className="size-12 text-green-500" />
                </div>
              )}
              <h2 className="text-xl font-bold">
                {isDone ? "Paper Processed!" : "Processing Question Paper..."}
              </h2>
              {isDone && (
                <p className="text-sm text-muted-foreground">
                  Redirecting to question paper view...
                </p>
              )}
            </div>

            {/* Steps */}
            <div className="w-full max-w-md space-y-3">
              {PROCESSING_STEPS.map((step, idx) => {
                const StepIcon = step.icon
                const isActive = idx === currentStep && !isDone
                const isCompleted = idx < currentStep || isDone

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-all duration-500",
                      isActive && "border-sky-400/40 bg-sky-50/50 shadow-sm dark:bg-sky-950/20",
                      isCompleted &&
                        "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20",
                      !isActive && !isCompleted && "border-transparent bg-muted/30 opacity-40",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg transition-all",
                        isActive && "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
                        isCompleted && "bg-green-500/10 text-green-500",
                        !isActive && !isCompleted && "bg-muted text-muted-foreground",
                      )}
                    >
                      {isActive ? (
                        <Loader2Icon className="size-5 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2Icon className="size-5" />
                      ) : (
                        <StepIcon className="size-5" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium transition-colors",
                        isActive && "text-foreground",
                        isCompleted && "text-green-600 dark:text-green-400",
                        !isActive && !isCompleted && "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
