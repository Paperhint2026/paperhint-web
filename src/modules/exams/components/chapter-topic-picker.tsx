import { useEffect, useMemo, useState } from "react"
import {
  BookOpenIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  FileTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sticker } from "@/components/shared/sticker"
import { cn } from "@/lib/utils"
import { tameCaps } from "@/lib/format"
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
  const isLoading =
    Boolean(classSubjectId) && curriculum?.class_subject_id !== classSubjectId
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [manualInput, setManualInput] = useState("")

  useEffect(() => {
    if (!classSubjectId) return
    let cancelled = false
    apiClient
      .get<CurriculumResponse>(
        `/api/knowledge/class-subject/${classSubjectId}/curriculum`
      )
      .then((res) => {
        if (!cancelled) setCurriculum(res)
      })
      .catch((err) => {
        console.error("Failed to fetch curriculum:", err)
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
        : a.secondary.localeCompare(b.secondary, undefined, { numeric: true })
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
            !chapter.topics.some((t) => makeTopicValue(chapter, t) === v)
        )
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
    const asTopicOfChapter = curriculum?.chapters.find(
      (c) => c.name === pill || pill.startsWith(`${c.name}${TOPIC_SEP}`)
    )
    if (asTopicOfChapter && asTopicOfChapter.name === pill) {
      onChange(
        value.filter(
          (v) =>
            v !== pill &&
            !asTopicOfChapter.topics.some(
              (t) => makeTopicValue(asTopicOfChapter, t) === v
            )
        )
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
  const chaptersWithoutMaterial =
    curriculum?.totals?.chapters_without_material ?? 0

  // What the trigger shows: one chip per chapter (with how many of its topics
  // were narrowed to), plus one per hand-typed chapter.
  const chips = useMemo(() => {
    const chapters = curriculum?.chapters ?? []
    const out: { key: string; label: string; detail?: string }[] = []
    const consumed = new Set<string>()
    for (const c of chapters) {
      const cKey = makeChapterValue(c)
      if (!valueSet.has(cKey)) continue
      consumed.add(cKey)
      const topicCount = c.topics.filter((t) => {
        const k = makeTopicValue(c, t)
        if (valueSet.has(k)) {
          consumed.add(k)
          return true
        }
        return false
      }).length
      out.push({
        key: cKey,
        label: c.name,
        detail:
          topicCount > 0
            ? `${topicCount} of ${c.topics.length} ${c.topics.length === 1 ? "topic" : "topics"}`
            : undefined,
      })
    }
    for (const v of value) if (!consumed.has(v)) out.push({ key: v, label: v })
    return out
  }, [curriculum, value, valueSet])

  const selectedChapterCount = chips.length
  const selectedTopicCount = value.filter((v) => v.includes(TOPIC_SEP)).length

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex min-h-10 w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted/40",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              open && "border-ring"
            )}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {chips.length === 0 ? (
                <span className="flex items-center gap-2 px-0.5 text-muted-foreground">
                  <BookOpenIcon className="size-4" aria-hidden="true" />
                  Choose chapters and topics…
                </span>
              ) : (
                chips.map((chip) => (
                  <span
                    key={chip.key}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/30 bg-primary/5 py-0.5 pr-1 pl-1.5 text-xs text-foreground"
                  >
                    <span className="truncate">{tameCaps(chip.label)}</span>
                    {chip.detail && (
                      <span className="shrink-0 text-muted-foreground">
                        · {chip.detail}
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${chip.label}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        removePill(chip.key)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          e.stopPropagation()
                          removePill(chip.key)
                        }
                      }}
                      className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </span>
                  </span>
                ))
              )}
            </div>
            <CaretDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-(--radix-popover-trigger-width) gap-0 p-0"
          align="start"
          sideOffset={6}
        >
          {/* Search */}
          <div className="border-b border-border p-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search chapters or topics…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search chapters or topics"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Tree */}
          <div
            className="max-h-72 overflow-y-auto p-1.5"
            onWheel={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="flex flex-col gap-2 p-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex h-9 items-center gap-2.5 px-2">
                    <Skeleton className="size-4 rounded" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            ) : !hasCurriculum ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <Sticker name="point" size={56} />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-foreground">
                    No chapters found yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upload a textbook in Knowledge. Hint reads it and lists the
                    chapters here.
                  </p>
                </div>
              </div>
            ) : filteredChapters.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                No chapter matches "{search.trim()}"
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {filteredChapters.map((chapter) => {
                  const selected = isChapterSelected(chapter)
                  const partial = isChapterPartial(chapter)
                  const expanded =
                    expandedIds.has(chapter.id) || !!search.trim()
                  const noFiles = chapter.coverage.material_count === 0
                  const chosenTopics = chapter.topics.filter((t) =>
                    isTopicSelected(chapter, t)
                  ).length

                  return (
                    <div key={chapter.id} className="flex flex-col">
                      {/* Chapter row */}
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted",
                          (selected || partial) && "bg-primary/[0.04]"
                        )}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={
                            selected ? true : partial ? "mixed" : false
                          }
                          onClick={() => toggleChapter(chapter)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : partial
                                  ? "border-primary bg-primary/20"
                                  : "border-input bg-background"
                            )}
                          >
                            {selected ? (
                              <CheckIcon weight="bold" className="size-3" />
                            ) : partial ? (
                              <span className="h-0.5 w-2 rounded bg-primary" />
                            ) : null}
                          </span>
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar text-[10px] font-semibold text-muted-foreground tabular-nums ring-1 ring-border/60">
                            {chapter.number}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {tameCaps(chapter.name)}
                          </span>
                        </button>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "flex shrink-0 items-center gap-1 text-[11px] tabular-nums",
                                noFiles
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              {noFiles ? (
                                <WarningIcon weight="fill" className="size-3" />
                              ) : (
                                <FileTextIcon className="size-3" />
                              )}
                              {noFiles
                                ? "no files"
                                : chapter.coverage.material_count}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {noFiles
                              ? "No uploaded material covers this chapter yet"
                              : `${chapter.coverage.material_count} uploaded ${chapter.coverage.material_count === 1 ? "file covers" : "files cover"} this chapter`}
                          </TooltipContent>
                        </Tooltip>

                        {chapter.topics.length > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(chapter.id)}
                            className="flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            aria-label={
                              expanded ? "Hide topics" : "Show topics"
                            }
                          >
                            {chosenTopics > 0
                              ? `${chosenTopics}/${chapter.topics.length}`
                              : chapter.topics.length}
                            <CaretRightIcon
                              weight="bold"
                              className={cn(
                                "size-3 transition-transform duration-200",
                                expanded && "rotate-90"
                              )}
                            />
                          </button>
                        )}
                      </div>

                      {/* Topics */}
                      {expanded && chapter.topics.length > 0 && (
                        <div className="my-1 ml-[1.9rem] flex flex-col gap-0.5 border-l border-border pl-2">
                          {chapter.topics.map((topic) => {
                            const tSel = isTopicSelected(chapter, topic)
                            return (
                              <button
                                key={topic.id}
                                type="button"
                                role="checkbox"
                                aria-checked={tSel}
                                onClick={() => toggleTopic(chapter, topic)}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
                                  tSel && "bg-primary/[0.04]"
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                                    tSel
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-input bg-background"
                                  )}
                                >
                                  {tSel && (
                                    <CheckIcon
                                      weight="bold"
                                      className="size-3"
                                    />
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 truncate text-[13px]",
                                    tSel
                                      ? "text-foreground"
                                      : "text-secondary-foreground"
                                  )}
                                >
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

          {/* Add a chapter the extraction missed */}
          <div className="border-t border-border p-2">
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
                placeholder="Add a chapter that isn't listed…"
                aria-label="Add a chapter"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1 text-xs"
                onClick={addManualChapter}
                disabled={!manualInput.trim()}
              >
                <PlusIcon className="size-3" />
                Add
              </Button>
            </div>
          </div>

          {/* Footer summary */}
          <div className="flex items-center justify-between border-t border-border bg-sidebar px-3 py-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {selectedChapterCount === 0
                ? "Nothing chosen yet"
                : `${selectedChapterCount} ${selectedChapterCount === 1 ? "chapter" : "chapters"}${selectedTopicCount > 0 ? ` · ${selectedTopicCount} ${selectedTopicCount === 1 ? "topic" : "topics"}` : ""}`}
            </span>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="transition-colors hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {chaptersWithoutMaterial > 0 && hasCurriculum && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <WarningIcon
            weight="fill"
            className="size-3 text-amber-500"
            aria-hidden="true"
          />
          {chaptersWithoutMaterial}{" "}
          {chaptersWithoutMaterial === 1 ? "chapter has" : "chapters have"} no
          uploaded material yet. Hint can still write questions for them, but
          from general knowledge rather than your book.
        </p>
      )}
    </div>
  )
}
