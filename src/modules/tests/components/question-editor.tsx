import { useMemo, useState } from "react"
import {
  CheckCircleIcon,
  CircleNotchIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  blankCount,
  QUESTION_TYPE_LABEL,
  type OnlineConfig,
  type QuestionType,
  type TestQuestion,
} from "@/modules/tests/types"

export interface QuestionDraft {
  type: QuestionType
  question_text: string
  marks: number
  online_config: OnlineConfig
}

const TYPE_ORDER: QuestionType[] = [
  "mcq",
  "true_false",
  "fill_blank",
  "match",
  "short_answer",
]

function emptyConfig(type: QuestionType): OnlineConfig {
  switch (type) {
    case "mcq":
      return { options: ["", "", "", ""], correct: [] }
    case "true_false":
      return { answer: true }
    case "fill_blank":
      return { blanks: [] }
    case "match":
      return { left: ["", ""], right: ["", ""], key: [0, 1] }
    case "short_answer":
      return { rubric: "" }
  }
}

/**
 * One sheet for creating/editing any question type. The teacher enters
 * match pairs ALIGNED (left[i] ↔ right[i], key = identity) — the student
 * page shuffles the right column at attempt time, so authoring stays
 * simple. Validation here is advisory; the server re-validates everything.
 */
export function QuestionEditor({
  open,
  onOpenChange,
  initial,
  saving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing question to edit; null = new. */
  initial: TestQuestion | null
  saving: boolean
  onSave: (draft: QuestionDraft) => void
}) {
  const isMobile = useIsMobile()
  const isEdit = initial != null
  const [type, setType] = useState<QuestionType>(initial?.type ?? "mcq")
  const [text, setText] = useState(initial?.question_text ?? "")
  const [marks, setMarks] = useState<number>(initial?.marks ?? 1)
  const [cfg, setCfg] = useState<OnlineConfig>(
    initial?.online_config ?? emptyConfig("mcq")
  )
  // Per-blank accepted answers are edited as comma-separated text.
  const [blankText, setBlankText] = useState<string[]>(
    (initial?.online_config.blanks ?? []).map((b) => b.join(", "))
  )

  // Reset whenever the sheet opens for a different subject.
  const [seenKey, setSeenKey] = useState<string | null>(null)
  const openKey = open ? (initial?.id ?? "new") : null
  if (openKey !== seenKey) {
    setSeenKey(openKey)
    if (openKey !== null) {
      setType(initial?.type ?? "mcq")
      setText(initial?.question_text ?? "")
      setMarks(initial?.marks ?? 1)
      setCfg(initial?.online_config ?? emptyConfig(initial?.type ?? "mcq"))
      setBlankText((initial?.online_config.blanks ?? []).map((b) => b.join(", ")))
    }
  }

  const switchType = (t: QuestionType) => {
    setType(t)
    setCfg(emptyConfig(t))
    setBlankText([])
  }

  const blanks = useMemo(() => blankCount(text), [text])

  const buildConfig = (): OnlineConfig => {
    if (type === "fill_blank") {
      return {
        blanks: Array.from({ length: blanks }, (_, i) =>
          (blankText[i] ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        ),
      }
    }
    if (type === "match") {
      // Aligned pairs: the key is the identity permutation.
      const left = (cfg.left ?? []).map((s) => s.trim())
      const right = (cfg.right ?? []).map((s) => s.trim())
      return { left, right, key: left.map((_, i) => i) }
    }
    return cfg
  }

  const canSave = (() => {
    if (!text.trim() || !(marks > 0)) return false
    switch (type) {
      case "mcq": {
        const opts = (cfg.options ?? []).filter((o) => o.trim())
        return opts.length >= 2 && (cfg.correct ?? []).some((i) => (cfg.options ?? [])[i]?.trim())
      }
      case "true_false":
        return typeof cfg.answer === "boolean"
      case "fill_blank":
        return (
          blanks > 0 &&
          Array.from({ length: blanks }).every((_, i) =>
            (blankText[i] ?? "").split(",").some((s) => s.trim())
          )
        )
      case "match": {
        const l = cfg.left ?? []
        const r = cfg.right ?? []
        return l.length >= 2 && l.every((s) => s.trim()) && r.every((s) => s.trim()) && l.length === r.length
      }
      case "short_answer":
        return Boolean(cfg.rubric?.trim())
    }
  })()

  const save = () => {
    if (!canSave || saving) return
    onSave({ type, question_text: text.trim(), marks, online_config: buildConfig() })
  }

  const setOption = (i: number, v: string) =>
    setCfg((c) => ({ ...c, options: (c.options ?? []).map((o, j) => (j === i ? v : o)) }))
  const toggleCorrect = (i: number) =>
    setCfg((c) => {
      const cur = new Set(c.correct ?? [])
      if (cur.has(i)) cur.delete(i)
      else cur.add(i)
      return { ...c, correct: [...cur].sort((a, b) => a - b) }
    })

  const setPair = (col: "left" | "right", i: number, v: string) =>
    setCfg((c) => ({ ...c, [col]: (c[col] ?? []).map((o, j) => (j === i ? v : o)) }))

  return (
    <Sheet open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        size={isMobile ? "full" : "lg"}
        className="flex w-full flex-col gap-0 p-0 data-[side=bottom]:h-dvh data-[side=bottom]:max-h-dvh"
      >
        <SheetHeader className="border-b px-4 py-3 sm:px-6">
          <SheetTitle>{isEdit ? "Edit question" : "Add a question"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `${QUESTION_TYPE_LABEL[type]} · the answer key stays on the server, students never see it.`
              : "Pick a type, write the question, mark the answer."}
          </SheetDescription>
        </SheetHeader>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-5 px-4 py-5 sm:px-6">
            {!isEdit && (
              <div className="flex flex-wrap gap-2">
                {TYPE_ORDER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => switchType(t)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      type === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {QUESTION_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">
                Question <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder={
                  type === "fill_blank"
                    ? "Ohm's law: V = I × ___  (three underscores make a blank)"
                    : "Type the question…"
                }
              />
              {type === "fill_blank" && (
                <p className="text-xs text-muted-foreground">
                  {blanks === 0
                    ? "Type ___ (three underscores) wherever a blank goes."
                    : `${blanks} blank${blanks === 1 ? "" : "s"} detected.`}
                </p>
              )}
            </div>

            {type === "mcq" && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm">
                  Options — tick every correct one{" "}
                  <span className="text-destructive">*</span>
                </Label>
                {(cfg.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={(cfg.correct ?? []).includes(i)}
                      onCheckedChange={() => toggleCorrect(i)}
                      aria-label={`Option ${i + 1} is correct`}
                    />
                    <Input
                      value={opt}
                      maxLength={200}
                      placeholder={`Option ${i + 1}`}
                      onChange={(e) => setOption(i, e.target.value)}
                    />
                    {(cfg.options ?? []).length > 2 && (
                      <button
                        type="button"
                        aria-label="Remove option"
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setCfg((c) => ({
                            ...c,
                            options: (c.options ?? []).filter((_, j) => j !== i),
                            correct: (c.correct ?? [])
                              .filter((x) => x !== i)
                              .map((x) => (x > i ? x - 1 : x)),
                          }))
                        }
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                {(cfg.options ?? []).length < 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      setCfg((c) => ({ ...c, options: [...(c.options ?? []), ""] }))
                    }
                  >
                    <PlusIcon className="size-3.5" />
                    Add option
                  </Button>
                )}
              </div>
            )}

            {type === "true_false" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">
                  Correct answer <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => setCfg({ answer: v })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition-colors",
                        cfg.answer === v
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      {cfg.answer === v && <CheckCircleIcon weight="fill" className="size-4" />}
                      {v ? "True" : "False"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {type === "fill_blank" && blanks > 0 && (
              <div className="flex flex-col gap-3">
                {Array.from({ length: blanks }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Label className="text-sm">
                      Blank {i + 1} — accepted answers{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={blankText[i] ?? ""}
                      placeholder="copper, Cu  (commas separate alternatives)"
                      onChange={(e) =>
                        setBlankText((cur) => {
                          const next = [...cur]
                          next[i] = e.target.value
                          return next
                        })
                      }
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Checking ignores case and extra spaces.
                </p>
              </div>
            )}

            {type === "match" && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm">
                  Pairs — write each match side by side; students see the right
                  column shuffled <span className="text-destructive">*</span>
                </Label>
                {(cfg.left ?? []).map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={l}
                      maxLength={200}
                      placeholder={`Left ${i + 1}`}
                      onChange={(e) => setPair("left", i, e.target.value)}
                    />
                    <span className="shrink-0 text-muted-foreground">→</span>
                    <Input
                      value={(cfg.right ?? [])[i] ?? ""}
                      maxLength={200}
                      placeholder={`Right ${i + 1}`}
                      onChange={(e) => setPair("right", i, e.target.value)}
                    />
                    {(cfg.left ?? []).length > 2 && (
                      <button
                        type="button"
                        aria-label="Remove pair"
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setCfg((c) => ({
                            ...c,
                            left: (c.left ?? []).filter((_, j) => j !== i),
                            right: (c.right ?? []).filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                {(cfg.left ?? []).length < 8 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      setCfg((c) => ({
                        ...c,
                        left: [...(c.left ?? []), ""],
                        right: [...(c.right ?? []), ""],
                      }))
                    }
                  >
                    <PlusIcon className="size-3.5" />
                    Add pair
                  </Button>
                )}
              </div>
            )}

            {type === "short_answer" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">
                  Model answer <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={cfg.rubric ?? ""}
                  rows={4}
                  maxLength={4000}
                  placeholder="The answer you'd give full marks to — the AI grades against this, and you review."
                  onChange={(e) => setCfg({ rubric: e.target.value })}
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">
                Marks <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                max={100}
                className="w-28"
                value={marks}
                onChange={(e) => setMarks(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-4 py-3 sm:px-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave || saving}>
            {saving ? <CircleNotchIcon className="size-4 animate-spin" /> : null}
            {isEdit ? "Save question" : "Add question"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
