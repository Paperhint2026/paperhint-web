import { useCallback, useEffect, useState } from "react"
import {
  BooksIcon,
  CheckIcon,
  CircleNotchIcon,
  DotsSixVerticalIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

type TopicStatus = "not_started" | "in_progress" | "done"

interface Topic {
  id: string
  position: number
  title: string
  detail: string | null
  status: TopicStatus
}

const NEXT_STATUS: Record<TopicStatus, TopicStatus> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
}

const STATUS_HINT: Record<TopicStatus, string> = {
  not_started: "Not started — tap when you begin",
  in_progress: "In progress — tap when finished",
  done: "Done — tap to reset",
}

/**
 * The class's topic spine. "Next per syllabus" in reminders and "continue
 * from last class" in generation both read this list, and journal entries
 * tick topics off automatically — this view is where the teacher curates it:
 * AI-bootstrap from Knowledge, drag to reorder, tap the ring to mark
 * progress, inline rename, add or remove.
 */
export function SyllabusView({ classSubjectId }: { classSubjectId: string }) {
  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [busy, setBusy] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const load = useCallback(() => {
    apiClient
      .get<{ topics: Topic[]; can_edit: boolean }>(
        `/api/notes/${classSubjectId}/syllabus`
      )
      .then((r) => {
        setTopics(r.topics ?? [])
        setCanEdit(r.can_edit)
      })
      .catch((err) => {
        showError(err, "Could not load the syllabus")
        setTopics([])
      })
  }, [classSubjectId])

  useEffect(() => {
    load()
  }, [load])

  /** Optimistic save: show `next` immediately, reconcile with the server. */
  const save = async (next: Topic[]) => {
    const prev = topics
    setTopics(next)
    setBusy(true)
    try {
      const res = await apiClient.put<{ topics: Topic[] }>(
        `/api/notes/${classSubjectId}/syllabus`,
        { topics: next.map(({ id, title, detail, status }) => ({ id, title, detail, status })) }
      )
      setTopics(res.topics)
    } catch (err) {
      showError(err, "Could not save the syllabus")
      setTopics(prev)
    } finally {
      setBusy(false)
    }
  }

  const bootstrap = async () => {
    setIsBootstrapping(true)
    try {
      const res = await apiClient.post<{ added: number; skipped: number; topics: Topic[] }>(
        `/api/notes/${classSubjectId}/syllabus/bootstrap`
      )
      setTopics(res.topics)
      toast.success(
        res.added > 0
          ? `Read your materials — ${res.added} topic${res.added > 1 ? "s" : ""} added`
          : "Nothing new — your syllabus already covers the materials"
      )
    } catch (err) {
      showError(err, "Could not read the materials")
    } finally {
      setIsBootstrapping(false)
    }
  }

  const cycleStatus = async (topic: Topic) => {
    if (!canEdit) return
    const status = NEXT_STATUS[topic.status]
    const prev = topics
    setTopics((cur) =>
      (cur ?? []).map((t) => (t.id === topic.id ? { ...t, status } : t))
    )
    try {
      await apiClient.patch(
        `/api/notes/${classSubjectId}/syllabus/${topic.id}`,
        { status }
      )
    } catch (err) {
      showError(err, "Could not update the topic")
      setTopics(prev)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !topics) return
    const oldIndex = topics.findIndex((t) => t.id === active.id)
    const newIndex = topics.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    void save(arrayMove(topics, oldIndex, newIndex))
  }

  const addTopic = () => {
    const title = newTitle.trim()
    if (!title || !topics) return
    setNewTitle("")
    void save([
      ...topics,
      { id: `new-${Date.now()}`, position: topics.length + 1, title, detail: null, status: "not_started" },
    ])
  }

  if (topics === null) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  const done = topics.filter((t) => t.status === "done").length

  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-12 text-center">
        <BooksIcon className="size-8 text-muted-foreground/60" />
        <div>
          <p className="text-sm font-medium">No syllabus yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            The syllabus is how Hint knows what comes next — reminders say
            "next per syllabus" and journal entries tick topics off
            automatically.
          </p>
        </div>
        {canEdit && (
          <>
            <Button onClick={() => void bootstrap()} disabled={isBootstrapping}>
              {isBootstrapping ? (
                <>
                  <CircleNotchIcon className="size-4 animate-spin" />
                  Reading your materials…
                </>
              ) : (
                <>
                  <SparkleIcon className="size-4" />
                  Build from Knowledge
                </>
              )}
            </Button>
            <div className="flex w-full max-w-sm items-center gap-2">
              <Input
                placeholder="…or add a topic yourself"
                value={newTitle}
                maxLength={200}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTopic()
                }}
              />
              <Button variant="outline" size="icon" aria-label="Add topic" onClick={addTopic} disabled={!newTitle.trim()}>
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Progress + append-from-knowledge */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="flex min-w-40 flex-1 items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(done / topics.length) * 100}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {done} of {topics.length} done
          </span>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void bootstrap()}
            disabled={isBootstrapping}
          >
            {isBootstrapping ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                Reading…
              </>
            ) : (
              <>
                <SparkleIcon className="size-4" />
                Add from Knowledge
              </>
            )}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={topics.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {topics.map((topic, i) => (
              <SortableTopicRow
                key={topic.id}
                topic={topic}
                index={i}
                canEdit={canEdit}
                onCycle={() => void cycleStatus(topic)}
                onRename={(title) => {
                  if (!title.trim() || title === topic.title) return
                  void save(
                    topics.map((t) =>
                      t.id === topic.id ? { ...t, title: title.trim() } : t
                    )
                  )
                }}
                onDelete={() =>
                  void save(topics.filter((t) => t.id !== topic.id))
                }
              />
            ))}
          </SortableContext>
        </DndContext>

        {canEdit && (
          <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2">
            <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Add a topic…"
              value={newTitle}
              maxLength={200}
              disabled={busy}
              className="h-8 border-none bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTopic()
              }}
            />
            {newTitle.trim() && (
              <Button size="sm" variant="outline" onClick={addTopic}>
                Add
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="px-1 text-[11px] text-muted-foreground">
        Ticks update on their own from your journal — logging "finished
        magnets" marks Exploring Magnets done. Drag to reorder; tap the ring
        to mark progress by hand.
      </p>
    </div>
  )
}

function SortableTopicRow({
  topic,
  index,
  canEdit,
  onCycle,
  onRename,
  onDelete,
}: {
  topic: Topic
  index: number
  canEdit: boolean
  onCycle: () => void
  onRename: (title: string) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: topic.id, disabled: !canEdit })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(topic.title)

  const commit = () => {
    setEditing(false)
    onRename(draft)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 px-2 py-2.5 sm:gap-3 sm:px-3",
        index > 0 && "border-t",
        isDragging && "relative z-10 bg-card shadow-lg ring-2 ring-primary/30",
        topic.status === "done" && "bg-muted/30"
      )}
    >
      {canEdit && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <DotsSixVerticalIcon className="size-4" />
        </button>
      )}

      {/* The ring: empty → half (in progress) → filled check (done) */}
      <button
        type="button"
        title={STATUS_HINT[topic.status]}
        aria-label={STATUS_HINT[topic.status]}
        disabled={!canEdit}
        onClick={onCycle}
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
          topic.status === "done"
            ? "border-primary bg-primary text-primary-foreground"
            : topic.status === "in_progress"
              ? "border-primary bg-primary/20"
              : "border-border hover:border-primary/50"
        )}
      >
        {topic.status === "done" && <CheckIcon className="size-3" weight="bold" />}
      </button>

      <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            maxLength={200}
            className="h-7 px-1.5 text-sm"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") {
                setDraft(topic.title)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => {
              setDraft(topic.title)
              setEditing(true)
            }}
            className={cn(
              "block w-full truncate text-left text-sm",
              topic.status === "done" && "text-muted-foreground line-through decoration-border",
              canEdit && "cursor-text"
            )}
          >
            {topic.title}
          </button>
        )}
        {topic.detail && !editing && (
          <p className="truncate text-xs text-muted-foreground">{topic.detail}</p>
        )}
      </div>

      {topic.status === "in_progress" && (
        <span className="hidden shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary sm:inline">
          in progress
        </span>
      )}

      {canEdit && (
        <button
          type="button"
          aria-label="Remove topic"
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-muted-foreground/40 transition-colors hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
        >
          <TrashIcon className="size-4" />
        </button>
      )}
    </div>
  )
}
