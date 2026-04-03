import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  EyeIcon,
  GripVerticalIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  ScissorsIcon,
  SpaceIcon,
  Trash2Icon,
  TypeIcon,
  AlertTriangleIcon,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Document,
  Page as PdfPage,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  BlobProvider,
} from "@react-pdf/renderer"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAppSelector } from "@/store"
import { Button } from "@/components/ui/button"

// ─── Types ────────────────────────────────────────────

interface ApiQuestion {
  id: string
  question_text: string
  section: string
  marks: number
  question_number: string
  question_order: number
  type: string
  options: string[] | null
}

interface Exam {
  id: string
  exam_name: string
  total_marks: number
  blueprint: { section: string; type: string; num_questions: number; marks_per_question: number }[]
}

type BlockType = "header" | "instruction" | "section-title" | "question" | "text" | "spacer" | "page-break"

interface Block {
  id: string
  type: BlockType
  content: string
  meta?: {
    questionNumber?: string
    marks?: number
    options?: string[] | null
    optionsPerRow?: 1 | 2
    section?: string
    questionType?: string
    originalId?: string
  }
}

// ─── Helpers ──────────────────────────────────────────

let blockCounter = 0
function newBlockId() {
  return `block-${++blockCounter}-${Date.now()}`
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, "[Formula]")
    .replace(/\$[^$]+\$/g, "[Formula]")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "[Diagram]")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s/gm, "• ")
    .trim()
}

function buildInitialBlocks(
  exam: Exam,
  questions: ApiQuestion[],
  schoolName: string,
): Block[] {
  const blocks: Block[] = []

  blocks.push({
    id: newBlockId(),
    type: "header",
    content: schoolName || "School Name",
  })

  blocks.push({
    id: newBlockId(),
    type: "text",
    content: exam.exam_name,
  })

  blocks.push({
    id: newBlockId(),
    type: "text",
    content: `Total Marks: ${exam.total_marks}    |    Time: 3 Hours`,
  })

  blocks.push({
    id: newBlockId(),
    type: "instruction",
    content:
      "General Instructions:\n1. All questions are compulsory.\n2. This question paper contains 5 sections — A, B, C, D and E.\n3. Write neat and legible answers.\n4. Draw diagrams wherever necessary.",
  })

  const sectionGroups: Record<string, ApiQuestion[]> = {}
  for (const q of questions) {
    const sec = q.section || "Other"
    if (!sectionGroups[sec]) sectionGroups[sec] = []
    sectionGroups[sec].push(q)
  }

  const sortedSections = Object.keys(sectionGroups).sort()

  for (const sec of sortedSections) {
    const bp = exam.blueprint?.find((b) => b.section === sec)

    blocks.push({
      id: newBlockId(),
      type: "section-title",
      content: `Section ${sec}${bp ? ` — ${bp.type}` : ""}`,
      meta: { section: sec },
    })

    if (bp) {
      blocks.push({
        id: newBlockId(),
        type: "instruction",
        content: `This section contains ${bp.num_questions} questions of ${bp.marks_per_question} mark(s) each.`,
      })
    }

    const sorted = [...sectionGroups[sec]].sort((a, b) => a.question_order - b.question_order)

    for (const q of sorted) {
      blocks.push({
        id: newBlockId(),
        type: "question",
        content: q.question_text,
        meta: {
          questionNumber: q.question_number,
          marks: q.marks,
          options: q.options,
          section: q.section,
          questionType: q.type,
          originalId: q.id,
        },
      })
    }
  }

  return blocks
}

// ─── Sortable Block Component ─────────────────────────

function SortableBlock({
  block,
  onUpdate,
  onRemove,
}: {
  block: Block
  onUpdate: (id: string, changes: Partial<Block>) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const blockStyles: Record<BlockType, string> = {
    header: "border-l-4 border-l-primary bg-primary/5",
    instruction: "border-l-4 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
    "section-title": "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
    question: "border-l-4 border-l-green-500 bg-background",
    text: "border-l-4 border-l-gray-400 bg-muted/30",
    spacer: "border-l-4 border-l-dashed border-l-muted-foreground/30 bg-muted/10",
    "page-break": "border-l-4 border-l-red-400 bg-red-50/30 dark:bg-red-950/10",
  }

  const typeLabels: Record<BlockType, string> = {
    header: "HEADER",
    instruction: "INSTRUCTIONS",
    "section-title": "SECTION",
    question: "QUESTION",
    text: "TEXT",
    spacer: "SPACER",
    "page-break": "PAGE BREAK",
  }

  const handleContentChange = (value: string) => {
    onUpdate(block.id, { content: value })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border transition-shadow",
        blockStyles[block.type],
        isDragging && "z-50 shadow-xl opacity-90",
      )}
    >
      {/* Minimal top bar — drag handle + label + delete */}
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-3" />
        </button>

        <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">
          {typeLabels[block.type]}
        </span>

        {block.type === "question" && (
          <div className="ml-1 flex items-center gap-1">
            <span className="text-[8px] text-muted-foreground/50">Q</span>
            <input
              value={block.meta?.questionNumber || ""}
              onChange={(e) =>
                onUpdate(block.id, { meta: { ...block.meta, questionNumber: e.target.value } })
              }
              className="w-8 border-none bg-transparent p-0 text-[9px] font-semibold text-green-600 outline-none dark:text-green-400"
            />
            <span className="text-[8px] text-muted-foreground/50">·</span>
            <input
              type="number"
              value={block.meta?.marks || 0}
              onChange={(e) =>
                onUpdate(block.id, { meta: { ...block.meta, marks: Number(e.target.value) } })
              }
              className="w-8 border-none bg-transparent p-0 text-[9px] font-semibold text-green-600 outline-none dark:text-green-400"
            />
            <span className="text-[8px] text-muted-foreground/50">marks</span>
          </div>
        )}

        <div className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onRemove(block.id)}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
            title="Remove block"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Inline-editable content */}
      <div className="px-3 pb-2.5">
        {block.type === "spacer" ? (
          <div className="flex h-6 items-center justify-center text-[10px] text-muted-foreground">
            — spacing —
          </div>
        ) : block.type === "page-break" ? (
          <div className="flex h-4 items-center justify-center">
            <div className="flex-1 border-t border-dashed border-red-300" />
            <span className="px-3 text-[10px] font-medium text-red-400">PAGE BREAK</span>
            <div className="flex-1 border-t border-dashed border-red-300" />
          </div>
        ) : block.type === "header" ? (
          <input
            value={block.content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full border-none bg-transparent text-center text-base font-bold outline-none ring-0 focus:ring-0"
            placeholder="School Name"
          />
        ) : block.type === "section-title" ? (
          <input
            value={block.content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="w-full border-none bg-transparent text-sm font-bold underline outline-none ring-0 focus:ring-0"
            placeholder="Section Title"
          />
        ) : block.type === "question" ? (
          <div>
            <div className="flex items-start gap-0.5">
              <span className="shrink-0 pt-0.5 text-xs font-semibold text-foreground">
                {block.meta?.questionNumber}.
              </span>
              <textarea
                value={block.content}
                onChange={(e) => handleContentChange(e.target.value)}
                rows={Math.max(2, Math.ceil(block.content.length / 80))}
                className="w-full resize-none border-none bg-transparent text-xs leading-relaxed outline-none ring-0 focus:ring-0"
                placeholder="Question text..."
              />
              <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground">
                [{block.meta?.marks}]
              </span>
            </div>
            {block.meta?.options && block.meta.options.length > 0 && (
              <div className="mt-2">
                {/* Layout toggle */}
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[8px] font-medium uppercase tracking-wider text-muted-foreground/50">
                    Options layout
                  </span>
                  <div className="flex rounded border bg-muted/30">
                    <button
                      onClick={() =>
                        onUpdate(block.id, { meta: { ...block.meta, optionsPerRow: 1 } })
                      }
                      className={cn(
                        "px-2 py-0.5 text-[9px] font-medium transition-colors",
                        (block.meta?.optionsPerRow ?? 2) === 1
                          ? "bg-primary text-primary-foreground rounded"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      1 per row
                    </button>
                    <button
                      onClick={() =>
                        onUpdate(block.id, { meta: { ...block.meta, optionsPerRow: 2 } })
                      }
                      className={cn(
                        "px-2 py-0.5 text-[9px] font-medium transition-colors",
                        (block.meta?.optionsPerRow ?? 2) === 2
                          ? "bg-primary text-primary-foreground rounded"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      2 per row
                    </button>
                  </div>
                </div>

                {/* Options */}
                <div
                  className={cn(
                    "grid gap-1.5 pl-5",
                    (block.meta?.optionsPerRow ?? 2) === 1 ? "grid-cols-1" : "grid-cols-2",
                  )}
                >
                  {block.meta.options.map((opt, i) => (
                    <textarea
                      key={i}
                      value={opt}
                      onChange={(e) => {
                        const updated = [...(block.meta?.options || [])]
                        updated[i] = e.target.value
                        onUpdate(block.id, { meta: { ...block.meta, options: updated } })
                      }}
                      rows={1}
                      className="resize-none rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors focus:border-border focus:bg-background focus:text-foreground"
                      onInput={(e) => {
                        const el = e.target as HTMLTextAreaElement
                        el.style.height = "auto"
                        el.style.height = el.scrollHeight + "px"
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <p className="mt-1 text-[8px] italic text-muted-foreground/40">
              Editing here won't change saved questions
            </p>
          </div>
        ) : (
          <textarea
            value={block.content}
            onChange={(e) => handleContentChange(e.target.value)}
            rows={Math.max(1, Math.ceil(block.content.length / 80))}
            className="w-full resize-none border-none bg-transparent text-xs leading-relaxed outline-none ring-0 focus:ring-0"
            placeholder="Type here..."
          />
        )}
      </div>
    </div>
  )
}

// ─── PDF Document ─────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 11 },
  header: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4 },
  text: { fontSize: 11, textAlign: "center", marginBottom: 3 },
  instruction: { fontSize: 9, marginBottom: 2, color: "#333", lineHeight: 1.6 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 4, textDecoration: "underline" },
  questionRow: { flexDirection: "row", marginBottom: 6 },
  questionNumber: { width: 30, fontFamily: "Helvetica-Bold", fontSize: 10 },
  questionContent: { flex: 1, fontSize: 10, lineHeight: 1.5 },
  marksText: { fontSize: 9, color: "#555", textAlign: "right", width: 40 },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 2, marginLeft: 30, marginBottom: 2 },
  optionItem2Col: { width: "48%", fontSize: 9, marginBottom: 3 },
  optionItem1Col: { width: "100%", fontSize: 9, marginBottom: 4 },
  spacer: { height: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#000", marginVertical: 8 },
})

function PdfDocument({ blocks }: { blocks: Block[] }) {
  const pages: Block[][] = [[]]
  for (const block of blocks) {
    if (block.type === "page-break") {
      pages.push([])
    } else {
      pages[pages.length - 1].push(block)
    }
  }

  return (
    <Document>
      {pages.map((pageBlocks, pageIdx) => (
        <PdfPage key={pageIdx} size="A4" style={pdfStyles.page}>
          {pageBlocks.map((block) => {
            switch (block.type) {
              case "header":
                return (
                  <View key={block.id}>
                    <Text style={pdfStyles.header}>{block.content}</Text>
                    <View style={pdfStyles.divider} />
                  </View>
                )
              case "text":
                return <Text key={block.id} style={pdfStyles.text}>{block.content}</Text>
              case "instruction":
                return (
                  <Text key={block.id} style={pdfStyles.instruction}>
                    {block.content}
                  </Text>
                )
              case "section-title":
                return (
                  <Text key={block.id} style={pdfStyles.sectionTitle}>
                    {block.content}
                  </Text>
                )
              case "question":
                return (
                  <View key={block.id}>
                    <View style={pdfStyles.questionRow}>
                      <Text style={pdfStyles.questionNumber}>
                        {block.meta?.questionNumber}.
                      </Text>
                      <Text style={pdfStyles.questionContent}>
                        {stripMarkdown(block.content)}
                      </Text>
                      <Text style={pdfStyles.marksText}>
                        [{block.meta?.marks}]
                      </Text>
                    </View>
                    {block.meta?.options && block.meta.options.length > 0 && (
                      <View style={pdfStyles.optionsRow}>
                        {block.meta.options.map((opt, i) => (
                          <Text
                            key={i}
                            style={
                              (block.meta?.optionsPerRow ?? 2) === 1
                                ? pdfStyles.optionItem1Col
                                : pdfStyles.optionItem2Col
                            }
                          >
                            {opt}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )
              case "spacer":
                return <View key={block.id} style={pdfStyles.spacer} />
              default:
                return null
            }
          })}
        </PdfPage>
      ))}
    </Document>
  )
}

// ─── Main Component ───────────────────────────────────

export function PdfBuilderPage() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const classParam = searchParams.get("class")
  const backUrl = classParam
    ? `/exams/${examId}/questions?class=${classParam}`
    : `/exams/${examId}/questions`

  const school = useAppSelector((state) => state.school.school)

  const [isLoading, setIsLoading] = useState(true)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [mode, setMode] = useState<"builder" | "preview">("builder")
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const fetchExam = useCallback(async () => {
    if (!examId) return
    setIsLoading(true)
    try {
      const res = await apiClient.get<{ exam: Exam; questions: ApiQuestion[] }>(
        `/api/exams/${examId}`,
      )
      const initial = buildInitialBlocks(res.exam, res.questions ?? [], school?.name ?? "")
      setBlocks(initial)
    } catch (err) {
      console.error("Failed to fetch exam:", err)
      toast.error("Failed to load question paper")
    } finally {
      setIsLoading(false)
    }
  }, [examId, school])

  useEffect(() => {
    fetchExam()
  }, [fetchExam])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setBlocks((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id)
      const newIdx = prev.findIndex((b) => b.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const updateBlock = (id: string, changes: Partial<Block>) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, ...changes, meta: changes.meta ? { ...b.meta, ...changes.meta } : b.meta }
          : b,
      ),
    )
  }

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const insertBlock = (type: BlockType, afterId?: string) => {
    const newBlock: Block = {
      id: newBlockId(),
      type,
      content:
        type === "text"
          ? "Type here..."
          : type === "instruction"
            ? "Instructions..."
            : type === "section-title"
              ? "Section Title"
              : type === "header"
                ? "Header"
                : "",
    }

    setBlocks((prev) => {
      if (!afterId) return [...prev, newBlock]
      const idx = prev.findIndex((b) => b.id === afterId)
      const copy = [...prev]
      copy.splice(idx + 1, 0, newBlock)
      return copy
    })
  }

  const renumberQuestions = () => {
    let qNum = 1
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.type === "question") {
          return { ...b, meta: { ...b.meta, questionNumber: String(qNum++) } }
        }
        return b
      }),
    )
    toast.success("Questions renumbered")
  }

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks])

  type RenderGroup =
    | { kind: "block"; block: Block }
    | { kind: "section"; titleBlock: Block; instructionBlock: Block | null; questionBlocks: Block[] }

  const renderGroups = useMemo<RenderGroup[]>(() => {
    const groups: RenderGroup[] = []
    let i = 0
    while (i < blocks.length) {
      const block = blocks[i]
      if (block.type === "section-title") {
        const section = block.meta?.section
        const titleBlock = block
        i++
        let instructionBlock: Block | null = null
        if (i < blocks.length && blocks[i].type === "instruction") {
          instructionBlock = blocks[i]
          i++
        }
        const questionBlocks: Block[] = []
        while (i < blocks.length && blocks[i].type === "question" && blocks[i].meta?.section === section) {
          questionBlocks.push(blocks[i])
          i++
        }
        groups.push({ kind: "section", titleBlock, instructionBlock, questionBlocks })
      } else {
        groups.push({ kind: "block", block })
        i++
      }
    }
    return groups
  }, [blocks])

  const swapQuestions = (sectionName: string, activeId: string, overId: string) => {
    setBlocks((prev) => {
      const sectionQs = prev.filter((b) => b.type === "question" && b.meta?.section === sectionName)
      const oldIdx = sectionQs.findIndex((b) => b.id === activeId)
      const newIdx = sectionQs.findIndex((b) => b.id === overId)
      if (oldIdx < 0 || newIdx < 0) return prev

      const reordered = arrayMove(sectionQs, oldIdx, newIdx)

      const result: Block[] = []
      let qIdx = 0
      for (const b of prev) {
        if (b.type === "question" && b.meta?.section === sectionName) {
          result.push(reordered[qIdx++])
        } else {
          result.push(b)
        }
      }
      return result
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate(backUrl)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
          </button>
          <h1 className="text-sm font-semibold">PDF Builder</h1>
        </div>

        <div className="flex items-center gap-2">
          {mode === "builder" && (
            <Button variant="outline" size="sm" className="text-xs" onClick={renumberQuestions}>
              Re-number
            </Button>
          )}

          <div className="flex rounded-lg border bg-muted p-0.5">
            <button
              onClick={() => setMode("builder")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3",
                mode === "builder"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <PencilIcon className="mr-1 inline-block size-3 sm:mr-1.5" />
              Builder
            </button>
            <button
              onClick={() => setMode("preview")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3",
                mode === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <EyeIcon className="mr-1 inline-block size-3 sm:mr-1.5" />
              Preview
            </button>
          </div>

          {mode === "preview" && (
            <PDFDownloadLink
              document={<PdfDocument blocks={blocks} />}
              fileName="Question-Paper.pdf"
            >
              {({ loading }) => (
                <Button size="sm" disabled={loading} className="text-xs">
                  {loading ? (
                    <Loader2Icon className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <DownloadIcon className="mr-1 size-3.5" />
                  )}
                  <span className="hidden sm:inline">Download</span> PDF
                </Button>
              )}
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {/* Content */}
      {mode === "builder" ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Insert toolbar */}
          <div className="hidden w-14 shrink-0 flex-col items-center gap-2 border-r bg-muted/20 py-4 sm:flex">
            <p className="mb-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground [writing-mode:vertical-lr]">
              Insert
            </p>
            {[
              { type: "text" as BlockType, icon: TypeIcon, label: "Text" },
              { type: "instruction" as BlockType, icon: AlertTriangleIcon, label: "Note" },
              { type: "section-title" as BlockType, icon: TypeIcon, label: "Section" },
              { type: "spacer" as BlockType, icon: SpaceIcon, label: "Space" },
              { type: "page-break" as BlockType, icon: ScissorsIcon, label: "Page" },
            ].map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => insertBlock(type)}
                className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={`Add ${label}`}
              >
                <Icon className="size-4" />
                <span className="text-[8px]">{label}</span>
              </button>
            ))}
          </div>

          {/* Blocks area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
            <div className="mx-auto max-w-2xl space-y-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                  {renderGroups.map((group) => {
                    if (group.kind === "block") {
                      const block = group.block
                      return (
                        <div key={block.id}>
                          <SortableBlock
                            block={block}
                            onUpdate={updateBlock}
                            onRemove={removeBlock}
                          />
                          <div className="flex h-4 items-center justify-center opacity-0 transition-opacity hover:opacity-100">
                            <button
                              onClick={() => insertBlock("spacer", block.id)}
                              className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-[9px] text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                            >
                              <PlusIcon className="size-2.5" />
                              Insert
                            </button>
                          </div>
                        </div>
                      )
                    }

                    const { titleBlock, instructionBlock, questionBlocks } = group
                    const sectionName = titleBlock.meta?.section || ""
                    const qIds = questionBlocks.map((q) => q.id)

                    const isCollapsed = collapsedSections.has(sectionName)
                    const toggleCollapse = () => {
                      setCollapsedSections((prev) => {
                        const next = new Set(prev)
                        if (next.has(sectionName)) next.delete(sectionName)
                        else next.add(sectionName)
                        return next
                      })
                    }
                    const totalMarks = questionBlocks.reduce((s, q) => s + (q.meta?.marks || 0), 0)

                    return (
                      <div
                        key={titleBlock.id}
                        className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/10"
                      >
                        {/* Section header bar */}
                        <div
                          className={cn(
                            "flex items-center justify-between bg-blue-100/60 px-4 py-2.5 dark:bg-blue-900/30",
                            isCollapsed ? "rounded-xl" : "rounded-t-xl",
                          )}
                        >
                          <div className="flex flex-1 items-center gap-2">
                            <button
                              onClick={toggleCollapse}
                              className="rounded p-0.5 text-blue-500 transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
                            >
                              {isCollapsed ? (
                                <ChevronRightIcon className="size-4" />
                              ) : (
                                <ChevronDownIcon className="size-4" />
                              )}
                            </button>
                            <div className="flex size-6 items-center justify-center rounded-md bg-blue-500 text-[10px] font-bold text-white">
                              {sectionName}
                            </div>
                            <input
                              value={titleBlock.content}
                              onChange={(e) => updateBlock(titleBlock.id, { content: e.target.value })}
                              className="flex-1 border-none bg-transparent text-sm font-semibold outline-none ring-0 focus:ring-0"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{questionBlocks.length} Qs</span>
                            <span>{totalMarks} marks</span>
                            <button
                              onClick={() => removeBlock(titleBlock.id)}
                              className="rounded p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            >
                              <Trash2Icon className="size-3" />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible body */}
                        {!isCollapsed && (
                          <>
                            {/* Section instruction */}
                            {instructionBlock && (
                              <div className="border-b border-blue-200 px-4 py-1.5 dark:border-blue-800">
                                <input
                                  value={instructionBlock.content}
                                  onChange={(e) => updateBlock(instructionBlock.id, { content: e.target.value })}
                                  className="w-full border-none bg-transparent text-[11px] italic text-muted-foreground outline-none ring-0 focus:ring-0"
                                  placeholder="Section instruction..."
                                />
                              </div>
                            )}

                            {/* Questions — sortable within section */}
                            <div className="space-y-1.5 p-3">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => {
                                  const { active, over } = event
                                  if (!over || active.id === over.id) return
                                  swapQuestions(sectionName, active.id as string, over.id as string)
                                }}
                              >
                                <SortableContext items={qIds} strategy={verticalListSortingStrategy}>
                                  {questionBlocks.map((q) => (
                                    <SortableBlock
                                      key={q.id}
                                      block={q}
                                      onUpdate={updateBlock}
                                      onRemove={removeBlock}
                                    />
                                  ))}
                                </SortableContext>
                              </DndContext>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      ) : (
        /* Preview mode */
        <div className="flex flex-1 items-start justify-center overflow-auto bg-zinc-100 p-4 dark:bg-zinc-900 sm:p-8">
          <BlobProvider document={<PdfDocument blocks={blocks} />}>
            {({ url, loading }) => {
              if (loading) {
                return (
                  <div className="flex h-[80vh] w-full max-w-[595px] items-center justify-center rounded-lg bg-white shadow-lg sm:h-[842px]">
                    <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
                  </div>
                )
              }
              if (url) {
                return (
                  <iframe
                    src={url}
                    className="h-[80vh] w-full max-w-[595px] rounded-lg bg-white shadow-lg sm:h-[842px]"
                    title="PDF Preview"
                  />
                )
              }
              return null
            }}
          </BlobProvider>
        </div>
      )}
    </div>
  )
}
