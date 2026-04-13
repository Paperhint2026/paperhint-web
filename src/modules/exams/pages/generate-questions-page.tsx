import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  FileTextIcon,
  Loader2Icon,
  SearchIcon,
  SparklesIcon,
  WandIcon,
} from "lucide-react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Question {
  section: string
  type: string
  question_number: string
  question_text: string
  options?: string[]
  answer_key: string
  marks: number
}

const GENERATION_STEPS = [
  { label: "Analyzing exam blueprint...", icon: FileTextIcon },
  { label: "Searching uploaded materials...", icon: SearchIcon },
  { label: "Reviewing previous papers...", icon: BrainCircuitIcon },
  { label: "Generating questions with AI...", icon: SparklesIcon },
  { label: "Validating & formatting output...", icon: WandIcon },
]

export function GenerateQuestionsPage() {
  const { classSubjectId, examId } = useParams<{ classSubjectId: string; examId: string }>()
  const navigate = useNavigate()
  const backUrl = `/class/${classSubjectId}/exams`

  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [isDone, setIsDone] = useState(false)
  const [, setGeneratedQuestions] = useState<Question[]>([])

  const EXAMPLE_PROMPTS = [
    "Generate a balanced question paper covering all chapters equally",
    "Focus more questions on Chapter 3 (Chemical Reactions) and Chapter 5 (Life Processes)",
    "Include application-based and HOTS questions for Sections D and E",
    "Mix easy, moderate, and difficult questions in 30:40:30 ratio",
    "Include diagram-based questions in the Long Answer section",
  ]

  const handleGenerate = async () => {
    if (!examId) return
    setIsGenerating(true)
    setCurrentStep(0)
    setIsDone(false)

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= GENERATION_STEPS.length - 1) {
          clearInterval(stepInterval)
          return prev
        }
        return prev + 1
      })
    }, 3000)

    try {
      const res = await apiClient.post<{ questions: Question[] }>(
        "/api/exams/generate",
        { exam_id: examId, prompt: prompt || "Generate a well-balanced question paper" },
      )
      clearInterval(stepInterval)
      setCurrentStep(GENERATION_STEPS.length - 1)
      setGeneratedQuestions(res.questions ?? [])
      setIsDone(true)
      toast.success(`${(res.questions ?? []).length} questions generated successfully!`)

      setTimeout(() => {
        navigate(`/class/${classSubjectId}/exams/${examId}/questions`)
      }, 2000)
    } catch (err: unknown) {
      clearInterval(stepInterval)
      setIsGenerating(false)
      setCurrentStep(-1)
      toast.error((err as Error).message || "Failed to generate questions")
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
        {!isGenerating ? (
          <>
            {/* Pre-generation view */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10">
                <SparklesIcon className="size-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Generate Question Paper</h1>
              <p className="max-w-md text-sm text-muted-foreground">
                PaperHint AI will generate questions based on your exam blueprint,
                uploaded materials, and previous papers.
              </p>
            </div>

            {/* Prompt input */}
            <div className="w-full space-y-3">
              <label className="text-sm font-medium">
                Instructions for AI <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Focus on Chapter 3 and 5, include diagram-based long answers..."
                rows={4}
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              {/* Example prompts */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Try these:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="rounded-lg border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button size="lg" onClick={handleGenerate} className="w-full max-w-sm">
              <SparklesIcon className="mr-2 size-5" />
              Generate Questions
            </Button>
          </>
        ) : (
          <>
            {/* Generating view */}
            <div className="flex flex-col items-center gap-4 text-center">
              {!isDone ? (
                <div className="relative flex size-24 items-center justify-center">
                  <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                  <SparklesIcon className="size-10 text-primary" />
                </div>
              ) : (
                <div className="flex size-24 items-center justify-center rounded-full bg-green-500/10">
                  <CheckCircle2Icon className="size-12 text-green-500" />
                </div>
              )}
              <h2 className="text-xl font-bold">
                {isDone ? "Questions Generated!" : "Generating Question Paper..."}
              </h2>
              {isDone && (
                <p className="text-sm text-muted-foreground">
                  Redirecting to question paper view...
                </p>
              )}
            </div>

            {/* Steps */}
            <div className="w-full max-w-md space-y-3">
              {GENERATION_STEPS.map((step, idx) => {
                const StepIcon = step.icon
                const isActive = idx === currentStep && !isDone
                const isCompleted = idx < currentStep || isDone

                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-all duration-500",
                      isActive && "border-primary/40 bg-primary/5 shadow-sm",
                      isCompleted && "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20",
                      !isActive && !isCompleted && "border-transparent bg-muted/30 opacity-40",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg transition-all",
                        isActive && "bg-primary/10 text-primary",
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
