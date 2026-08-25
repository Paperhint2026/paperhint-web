import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// ── Types ─────────────────────────────────────────────────────────────────
// Response shape of GET /api/knowledge/class-subject/:id/curriculum.
// Keep in sync with knowledge.controller.js -> exports.getCurriculum.

type Topic = { id: string; name: string }
type Chapter = {
  id: string
  number: string
  name: string
  order: number
  source: "extracted" | "teacher_added"
  topics: Topic[]
  coverage: {
    material_count: number
    confidence_breakdown: { high: number; medium: number; low: number }
  }
}
type CurriculumResponse = {
  class_subject_id: string
  chapters: Chapter[]
  totals: {
    chapters: number
    chapters_with_material: number
    chapters_without_material: number
  }
}

type Props = {
  classSubjectId: string
  // Free-form strings that end up in exams.chapters_selected. Backwards
  // compatible with the previous chip-based free-text input, so an exam
  // saved before the picker was introduced still reads fine.
  value: string[]
  onChange: (next: string[]) => void
}

// ── Storage convention ────────────────────────────────────────────────────
// The picker persists into exams.chapters_selected using these string shapes:
//
//   "Coal and Petroleum"                          — whole chapter selected
//   "Coal and Petroleum · Formation of Coal"      — a specific topic (parent
//                                                   chapter is ALSO added
//                                                   so backend coverage
//                                                   lookup catches it)
//
// The parent chapter is always present alongside its selected topics — this
// is what lets getReferenceMaterials on the backend still find the material
// coverage (which is keyed on chapter slug) when the teacher narrows to
// specific topics.
const TOPIC_SEP = " · "

function makeChapterValue(chapter: Chapter): string {
  return chapter.name
}

function makeTopicValue(chapter: Chapter, topic: Topic): string {
  return `${chapter.name}${TOPIC_SEP}${topic.name}`
}

// ── Component ─────────────────────────────────────────────────────────────

export function ChapterTopicPicker({ classSubjectId, value, onChange }: Props) {
  const [curriculum, setCurriculum] = useState<CurriculumResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [manualInput, setManualInput] = useState("")

  useEffect(() => {
    if (!classSubjectId) return
    let cancelled = false
    setIsLoading(true)
    apiClient
      .get<CurriculumResponse>(
        `/api/knowledge/class-subject/${classSubjectId}/curriculum`,
      )
      .then((res) => {
        if (!cancelled) setCurriculum(res)
      })
      .catch((err) => {
        console.error("Failed to fetch curriculum:", err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [classSubjectId])

  // ── Derived selection state ──────────────────────────────────────────
  // Chapter is "selected" if its name string is present in value.
  // Topic is "selected" if the "Chapter · Topic" combination is present.
  const valueSet = useMemo(() => new Set(value), [value])
  const selectedChapterNames = valueSet
  const selectedTopicKeys = valueSet

  const isChapterSelected = (chapter: Chapter) =>
    selectedChapterNames.has(makeChapterValue(chapter))
  const isTopicSelected = (chapter: Chapter, topic: Topic) =>
    selectedTopicKeys.has(makeTopicValue(chapter, topic))
  const isChapterPartial = (chapter: Chapter) =>
    !isChapterSelected(chapter) &&
    chapter.topics.some((t) => isTopicSelected(chapter, t))

  // Natural chapter order (parse chapter_number as int when possible).
  // Falls back to alpha for non-numeric labels ("A1", "A2", "Unit II") which
  // sort AFTER numerics so appendices land at the end.
  const sortedChapters = useMemo(() => {
    const chapters = curriculum?.chapters ?? []
    const scored = chapters.map((c) => {
      const num = parseInt(c.number, 10)
      return {
        c,
        // Primary key: numeric chapter number if we can parse one; else a
        // large sentinel so alpha labels sort last.
        primary: Number.isFinite(num) ? num : 10_000,
        // Secondary: full chapter_number string for stable ordering of
        // "3", "3A" or "A1", "A2".
        secondary: c.number,
      }
    })
    scored.sort((a, b) =>
      a.primary !== b.primary
        ? a.primary - b.primary
        : a.secondary.localeCompare(b.secondary, undefined, { numeric: true }),
    )
    return scored.map((s) => s.c)
  }, [curriculum])

  const filteredChapters = useMemo(() => {
    if (!search.trim()) return sortedChapters
    const q = search.toLowerCase()
    return sortedChapters.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true
      if (c.number.toLowerCase().includes(q)) return true
      return c.topics.some((t) => t.name.toLowerCase().includes(q))
    })
  }, [sortedChapters, search])

  // ── Mutations ────────────────────────────────────────────────────────
  const toggleChapter = (chapter: Chapter) => {
    const val = makeChapterValue(chapter)
    if (isChapterSelected(chapter)) {
      // Uncheck the whole chapter and clear its topics — a chapter isn't
      // really "selected" if its topics remain, since coverage lookup keys
      // on the chapter name.
      onChange(
        value.filter(
          (v) =>
            v !== val &&
            !chapter.topics.some((t) => makeTopicValue(chapter, t) === v),
        ),
      )
    } else {
      onChange([...value, val])
    }
  }

  const toggleTopic = (chapter: Chapter, topic: Topic) => {
    const topicKey = makeTopicValue(chapter, topic)
    const chapterKey = makeChapterValue(chapter)
    if (isTopicSelected(chapter, topic)) {
      onChange(value.filter((v) => v !== topicKey))
    } else {
      // Ensure the parent chapter is present. This is what makes the
      // backend coverage lookup find the material — coverage is keyed on
      // chapter slug, not on topic-scoped strings.
      const next = valueSet.has(chapterKey)
        ? [...value, topicKey]
        : [...value, chapterKey, topicKey]
      onChange(next)
    }
  }

  const removePill = (pill: string) => {
    // If the pill is a chapter name, also remove any of its topic pills.
    const asTopicOfChapter = curriculum?.chapters.find((c) =>
      c.name === pill || pill.startsWith(`${c.name}${TOPIC_SEP}`),
    )
    if (asTopicOfChapter && asTopicOfChapter.name === pill) {
      onChange(
        value.filter(
          (v) =>
            v !== pill &&
            !asTopicOfChapter.topics.some(
              (t) => makeTopicValue(asTopicOfChapter, t) === v,
            ),
        ),
      )
    } else {
      onChange(value.filter((v) => v !== pill))
    }
  }

  const addManualChapter = () => {
    const trimmed = manualInput.trim()
    if (!trimmed) return
    if (valueSet.has(trimmed)) {
      setManualInput("")
      return
    }
    onChange([...value, trimmed])
    setManualInput("")
  }

  const toggleExpand = (chapterId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  // ── Render ───────────────────────────────────────────────────────────

  const hasCurriculum = (curriculum?.chapters?.length ?? 0) > 0
  const chaptersWithoutMaterial = curriculum?.totals?.chapters_without_material ?? 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Chapters / Topics</Label>
        {chaptersWithoutMaterial > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <AlertTriangleIcon className="size-3" aria-hidden="true" />
            {chaptersWithoutMaterial} chapter{chaptersWithoutMaterial === 1 ? "" : "s"} without material
          </span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between gap-2 font-normal"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpenIcon className="size-4" aria-hidden="true" />
              {value.length === 0
                ? "Select chapters and topics"
                : `${value.length} selected`}
            </span>
            <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
          <div className="border-b p-2">
            <Input
              placeholder="Search chapters or topics…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div
            className="max-h-[260px] overflow-y-scroll py-1"
            onWheel={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : !hasCurriculum ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <BookOpenIcon className="size-8 text-muted-foreground/40" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No chapters extracted yet</p>
                <p className="text-xs text-muted-foreground/80">
                  Upload a textbook or notes in the <span className="font-medium">Knowledge</span> tab.
                  Chapters will appear here after processing.
                </p>
              </div>
            ) : filteredChapters.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No chapters match "{search}"
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredChapters.map((chapter) => {
                  const selected = isChapterSelected(chapter)
                  const partial = isChapterPartial(chapter)
                  const expanded = expandedIds.has(chapter.id) || !!search.trim()
                  const noFiles = chapter.coverage.material_count === 0

                  return (
                    <div key={chapter.id} className="flex flex-col">
                      <div className="flex items-center gap-1 px-2 py-1 hover:bg-muted/50">
                        {chapter.topics.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(chapter.id)}
                            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                            aria-label={expanded ? "Collapse" : "Expand"}
                          >
                            {expanded ? (
                              <ChevronDownIcon className="size-3.5" />
                            ) : (
                              <ChevronRightIcon className="size-3.5" />
                            )}
                          </button>
                        ) : (
                          <div className="size-5" />
                        )}

                        <button
                          type="button"
                          onClick={() => toggleChapter(chapter)}
                          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left"
                        >
                          <div
                            className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : partial
                                  ? "border-primary bg-primary/30"
                                  : "border-muted-foreground/30"
                            }`}
                          >
                            {selected && <CheckIcon className="size-3" />}
                          </div>
                          <span className="flex-1 truncate text-sm">
                            <span className="text-muted-foreground">{chapter.number}.</span>{" "}
                            {chapter.name}
                          </span>
                          {noFiles ? (
                            <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-amber-600 dark:text-amber-400">
                              <AlertTriangleIcon className="size-3" aria-hidden="true" />
                              no files
                            </span>
                          ) : (
                            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                              {chapter.coverage.material_count} file
                              {chapter.coverage.material_count === 1 ? "" : "s"}
                            </span>
                          )}
                        </button>
                      </div>

                      {expanded && chapter.topics.length > 0 && (
                        <div className="flex flex-col pb-1 pl-9">
                          {chapter.topics.map((topic) => {
                            const tSel = isTopicSelected(chapter, topic)
                            return (
                              <button
                                key={topic.id}
                                type="button"
                                onClick={() => toggleTopic(chapter, topic)}
                                className="flex items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted/50"
                              >
                                <div
                                  className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                    tSel
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-muted-foreground/30"
                                  }`}
                                >
                                  {tSel && <CheckIcon className="size-3" />}
                                </div>
                                <span className="flex-1 truncate text-[13px] text-muted-foreground">
                                  {topic.name}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Manual add — for chapters missing from the catalog (typos in the
              knowledge material, or content not yet uploaded). Same shape as
              extracted chapters so backend behaviour is uniform. */}
          <div className="border-t p-2">
            <div className="flex gap-1.5">
              <Input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addManualChapter()
                  }
                }}
                placeholder="Add a chapter not listed above…"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                onClick={addManualChapter}
                disabled={!manualInput.trim()}
              >
                <PlusIcon className="size-3" />
                Add
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selection chips below the trigger — the picker keeps the visible
          selection state visible after closing the popover, and each pill
          removes independently. */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((pill) => {
            const isTopic = pill.includes(TOPIC_SEP)
            return (
              <span
                key={pill}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${
                  isTopic
                    ? "bg-muted text-foreground"
                    : "bg-primary/10 font-medium text-primary"
                }`}
              >
                {pill}
                <button
                  type="button"
                  onClick={() => removePill(pill)}
                  className="ml-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={`Remove ${pill}`}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
