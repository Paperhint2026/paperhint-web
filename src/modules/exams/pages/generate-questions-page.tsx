import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  BookOpenIcon,
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
  // Pre-selected chapters and topics from exam creation, displayed at top
  // so the teacher sees what the AI already knows about — no need to
  // restate them in the prompt.
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [examName, setExamName] = useState<string>("")

  useEffect(() => {
    if (!examId) return
    apiClient
      .get<{ exam: { exam_name: string; chapters_selected: string[] } }>(`/api/exams/${examId}`)
      .then((res) => {
        setSelectedChapters(res.exam?.chapters_selected ?? [])
        setExamName(res.exam?.exam_name ?? "")
      })
      .catch(() => {
        // Non-fatal — the AI still gets chapters_selected from the server
        // when it fetches the exam itself. This is display-only.
      })
  }, [examId])

  // Suggestions guide the STYLE / FLAVOR of the paper. Chapters are already
  // fixed by exam creation, so nothing here mentions which chapters to focus on.
  const EXAMPLE_PROMPTS = [
    "Emphasise real-world application and case studies",
    "Focus on core concepts and definitions from the textbook",
    "Include diagram-based and HOTS (higher-order thinking) questions",
    "Mix easy, moderate, and difficult questions in a 30:40:30 ratio",
    "Match the style and difficulty of previous CBSE board papers",
    "Prioritise numerical / calculation-heavy questions",
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

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 p-4 sm:p-6">
        {!isGenerating ? (
          <>
            {/* Pre-generation view */}
            <div className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <SparklesIcon className="size-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold">
                Generate Question Paper
                {examName ? <span className="ml-1 font-normal text-muted-foreground">· {examName}</span> : null}
              </h1>
              <p className="max-w-md text-xs text-muted-foreground">
                Uses the chapters selected at exam setup and their materials. Tell the AI how the paper should feel.
              </p>
            </div>

            {/* Chapters / topics already fixed by exam creation — display
                only, not editable here. If the teacher needs to change these,
                they edit the exam itself. */}
            {selectedChapters.length > 0 && (
              <div className="w-full space-y-1.5 rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <BookOpenIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Chapters &amp; topics
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                    from exam setup
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedChapters.map((c) => {
                    const isTopic = c.includes(" · ")
                    return (
                      <span
                        key={c}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs",
                          isTopic
                            ? "bg-muted text-foreground"
                            : "bg-primary/10 font-medium text-primary",
                        )}
                      >
                        {c}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Prompt input */}
            <div className="w-full space-y-2">
              <label className="text-xs font-medium">
                Instructions for AI <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., emphasise application-based questions with real-world context; include diagram-based long answers…"
                rows={2}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              {/* Example prompts — 2 per row so 6 chips fit in 3 lines */}
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Try these:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrompt(p)}
                      className="truncate rounded-md border bg-muted/50 px-2.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                      title={p}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={handleGenerate} className="w-full max-w-sm">
              <SparklesIcon className="mr-2 size-4" />
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
