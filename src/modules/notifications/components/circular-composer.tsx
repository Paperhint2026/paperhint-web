import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleNotchIcon,
  ImageIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { RichTextEditor } from "@/components/shared/rich-text-editor"
import {
  AUDIENCE_TYPE_LABEL,
  KIND_LABEL,
  PARENT_LANGUAGE_LABEL,
  circularsApi,
  type Audience,
  type AudienceOptions,
  type AudiencePreview,
  type AudienceType,
  type CircularKind,
} from "@/modules/notifications/lib/circulars-api"
import { useAuth } from "@/lib/auth"
import { useAppSelector } from "@/store"
import { apiClient } from "@/lib/api-client"
import { classCode, useTeacherAssignments } from "@/hooks/use-teacher-assignments"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MAX_FILES = 10
const MAX_FILE_MB = 15

/**
 * The admin's composer, shaped like an email: who → subject → message →
 * attachments → Send. The audience picker resolves LIVE against the school
 * ("Reaches 14 teachers", expandable to names) so nobody is surprised by
 * who got it.
 */
export function CircularComposer() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const workspaceKind = useAppSelector((s) => s.school.school?.kind)
  // Coaching/solo owners are workspace admins server-side; a plain school
  // teacher composes in parents-only mode scoped to her classes.
  const isSenderAdmin =
    user?.role === "admin" || workspaceKind === "solo" || workspaceKind === "coaching"
  const isCoaching = workspaceKind === "coaching"
  const groupNoun = isCoaching ? "batch" : "class"
  const { assignments } = useTeacherAssignments()

  const [options, setOptions] = useState<AudienceOptions | null>(null)
  const [type, setType] = useState<AudienceType>(isSenderAdmin ? "all_teachers" : "parents")
  const [kind, setKind] = useState<CircularKind>("circular")
  const [relayToParents, setRelayToParents] = useState(false)
  const [parentClassIds, setParentClassIds] = useState<string[]>([])
  const [allClasses, setAllClasses] = useState<
    { id: string; grade: number; section: string; name?: string | null }[]
  >([])
  const [grades, setGrades] = useState<number[]>([])
  const [teacherIds, setTeacherIds] = useState<string[]>([])
  const [teacherSearch, setTeacherSearch] = useState("")
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [subject, setSubject] = useState("")
  const [bodyMd, setBodyMd] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  // Images placed INSIDE the message: object-URL → file. The editor shows
  // the object URL; on send each referenced one uploads as inline_images/<cid>
  // and the markdown's blob: src is swapped for cid:<cid> (resolved back to
  // a signed URL by the server on every read).
  const inlineImagesRef = useRef(new Map<string, File>())
  useEffect(() => {
    const map = inlineImagesRef.current
    return () => {
      for (const url of map.keys()) URL.revokeObjectURL(url)
    }
  }, [])

  const pickInlineImage = (file: File): string | null => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only images can be placed inside the message")
      return null
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`"${file.name}" is over ${MAX_FILE_MB} MB`)
      return null
    }
    if (inlineImagesRef.current.size >= 10) {
      toast.error("Up to 10 images inside a message")
      return null
    }
    const url = URL.createObjectURL(file)
    inlineImagesRef.current.set(url, file)
    return url
  }

  useEffect(() => {
    if (!isSenderAdmin) return
    circularsApi
      .options()
      .then(setOptions)
      .catch((err) => showError(err, "Could not load the school's teachers"))
  }, [isSenderAdmin])

  // The parents picker's class list: admins pick from the whole school,
  // teachers from their own classes (the server enforces the same scope).
  useEffect(() => {
    if (isSenderAdmin) {
      apiClient
        .get<{ classes: { id: string; grade: number; section: string; name?: string | null }[] }>(
          "/api/classes"
        )
        .then((r) => setAllClasses(r.classes ?? []))
        .catch(() => setAllClasses([]))
    } else {
      const seen = new Map<string, { id: string; grade: number; section: string; name?: string | null }>()
      for (const a of assignments) {
        if (a.class && !seen.has(a.class.id)) seen.set(a.class.id, { ...a.class })
      }
      setAllClasses([...seen.values()])
    }
  }, [isSenderAdmin, assignments])

  const audience = useMemo<Audience>(
    () => ({
      type,
      grades,
      teacher_ids: teacherIds,
      ...(type === "parents"
        ? { parents: { enabled: true, class_ids: parentClassIds } }
        : {}),
    }),
    [type, grades, teacherIds, parentClassIds]
  )
  const needsGrades = type === "grades" || type === "class_teachers_grades"
  const canRelay =
    isSenderAdmin &&
    (type === "all_teachers" || type === "class_teachers" || type === "class_teachers_grades")
  const audienceReady =
    (!needsGrades || grades.length > 0) && (type !== "teachers" || teacherIds.length > 0)

  // Live "reaches N" — debounced, and skipped while the audience is incomplete.
  useEffect(() => {
    if (!audienceReady) {
      setPreview(null)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      circularsApi
        .preview(audience)
        .then((p) => {
          if (!cancelled) setPreview(p)
        })
        .catch(() => {
          if (!cancelled) setPreview(null)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [audience, audienceReady])

  // Object URLs for image previews, revoked on change/unmount.
  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    [files]
  )
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews])

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const next = [...files]
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) {
        toast.error(`Up to ${MAX_FILES} attachments`)
        break
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`"${f.name}" is over ${MAX_FILE_MB} MB`)
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  const toggleGrade = (g: number) =>
    setGrades((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g].sort((a, b) => a - b)))
  const toggleTeacher = (id: string) =>
    setTeacherIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const reachTotal = (preview?.count ?? 0) + (preview?.parent_count ?? 0)
  const canSend =
    audienceReady && subject.trim().length > 0 && bodyMd.trim().length > 0 && !sending && reachTotal > 0

  const send = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const form = new FormData()
      form.append("subject", subject.trim())
      form.append("audience", JSON.stringify(audience))
      form.append("kind", kind)
      if (canRelay && relayToParents) form.append("relay_to_parents", "true")
      for (const f of files) form.append("files", f, f.name)
      // Swap each still-referenced inline image's blob: src for a stable cid
      // and ship the file alongside; images deleted from the editor are
      // simply never uploaded.
      let body = bodyMd
      let i = 0
      for (const [url, file] of inlineImagesRef.current) {
        if (!body.includes(url)) continue
        const cid = `img-${Date.now().toString(36)}-${i++}`
        const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".png").toLowerCase()
        body = body.split(url).join(`cid:${cid}`)
        form.append("inline_images", file, `${cid}${ext}`)
      }
      form.append("body_md", body)
      const r = await circularsApi.create(form)
      const nT = r.circular.recipients_total ?? preview?.count ?? 0
      const nP = r.circular.parent_recipients_total ?? preview?.parent_count ?? 0
      const parts = []
      if (nT > 0) parts.push(`${nT} teacher${nT === 1 ? "" : "s"}`)
      if (nP > 0) parts.push(`${nP} parent${nP === 1 ? "" : "s"}`)
      toast.success(`Sent to ${parts.join(" and ") || "the audience"}`)
      navigate(`/notifications/circulars/${r.circular.id}`, { replace: true })
    } catch (err) {
      showError(err, "Could not send the circular")
    } finally {
      setSending(false)
    }
  }

  const filteredTeachers = (options?.teachers ?? []).filter((t) =>
    t.full_name.toLowerCase().includes(teacherSearch.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("/notifications/circulars")}>
          <ArrowLeftIcon className="size-4" />
          All circulars
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── Message ── */}
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CircularKind)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as CircularKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="circular-subject">Subject</Label>
            <Input
              id="circular-subject"
              placeholder="e.g. Half-day on Friday — revised bell schedule"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Message</Label>
            <RichTextEditor
              value=""
              onChange={setBodyMd}
              placeholder="Write the circular. Use the image button in the toolbar to place a picture right here in the message."
              minHeightClass="min-h-[260px]"
              onPickImage={pickInlineImage}
            />
          </div>

          {/* Attachments */}
          <div className="flex flex-col gap-2">
            <Label>
              Attachments{" "}
              <span className="font-normal text-muted-foreground">
                (sent as files — to show a picture inside the message, use the
                image button in the toolbar above)
              </span>
            </Label>
            <label
              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
            >
              <PaperclipIcon className="size-5" />
              <span>Drop files here or click to choose</span>
              <span className="text-[11px]">PDF, Word, Excel, images · up to {MAX_FILE_MB} MB each</span>
              <input
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-xs">
                    {previews[i] ? (
                      <img src={previews[i]!} alt="" className="size-8 rounded object-cover" />
                    ) : (
                      <PaperclipIcon className="size-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[12rem] truncate">{f.name}</span>
                    {previews[i] && <ImageIcon className="size-3.5 text-muted-foreground" />}
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                      onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Audience ── */}
        {/* On a phone this stacks FIRST — "To:" before the message, like
            mail — and the Send button repeats under the message so the
            teacher never scrolls back up to send. */}
        <aside className="order-first flex flex-col gap-4 rounded-xl border bg-card p-4 lg:order-none lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-2">
            <UsersThreeIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Send to</p>
          </div>

          {isSenderAdmin && options === null ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : (
            <>
              {!isSenderAdmin && (
                <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-secondary-foreground">
                  Goes to the parents of your {groupNoun}es. Pick specific ones
                  below, or leave all selected.
                </p>
              )}
              {isSenderAdmin && (
              <div className="flex flex-col gap-1">
                {(Object.keys(AUDIENCE_TYPE_LABEL) as AudienceType[]).map((t) => {
                  const hint =
                    t === "all_teachers"
                      ? `${options?.teacher_count ?? 0} teachers`
                      : t === "class_teachers"
                        ? `${options?.class_teacher_count ?? 0} class teachers`
                        : null
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        type === t ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted"
                      )}
                    >
                      <span className={cn(type === t && "font-medium")}>{AUDIENCE_TYPE_LABEL[t]}</span>
                      {hint && <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{hint}</span>}
                      {type === t && <CheckIcon className="size-4 text-primary" />}
                    </button>
                  )
                })}
              </div>
              )}

              {canRelay && (
                <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs text-secondary-foreground">
                  <Checkbox
                    checked={relayToParents}
                    onCheckedChange={(v) => setRelayToParents(!!v)}
                    className="mt-0.5"
                  />
                  <span>
                    Ask these teachers to <span className="font-medium">forward this to their {groupNoun}'s parents</span> —
                    each gets a one-tap forward on the circular.
                  </span>
                </label>
              )}

              {type === "parents" && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {isCoaching ? "Batches" : "Classes"}{" "}
                    <span className="font-normal">(none picked = all)</span>
                  </Label>
                  <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                    {allClasses.map((c) => {
                      const active = parentClassIds.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setParentClassIds((cur) =>
                              cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]
                            )
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          {classCode(c)}
                        </button>
                      )
                    })}
                    {allClasses.length === 0 && (
                      <span className="text-xs text-muted-foreground">No {groupNoun}es yet</span>
                    )}
                  </div>
                </div>
              )}

              {isSenderAdmin && needsGrades && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Grades</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(options?.grades ?? []).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGrade(g)}
                        className={cn(
                          "min-w-9 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          grades.includes(g)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  {(options?.grades.length ?? 0) > 1 && (
                    <div className="flex gap-2 text-[11px]">
                      <button type="button" className="text-primary hover:underline" onClick={() => setGrades([...(options?.grades ?? [])])}>
                        All grades
                      </button>
                      <button type="button" className="text-muted-foreground hover:underline" onClick={() => setGrades([])}>
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isSenderAdmin && type !== "parents" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {type === "teachers" ? "Teachers" : "Also include specific teachers"}
                </Label>
                <Input
                  placeholder="Search teachers…"
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="h-8 text-sm"
                />
                <ul className="max-h-44 overflow-y-auto rounded-lg border">
                  {filteredTeachers.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-muted-foreground">No teachers match</li>
                  ) : (
                    filteredTeachers.map((t) => (
                      <li key={t.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/60">
                          <Checkbox checked={teacherIds.includes(t.id)} onCheckedChange={() => toggleTeacher(t.id)} />
                          <span className="truncate">{t.full_name}</span>
                        </label>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              )}

              {/* Live reach */}
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                {!audienceReady ? (
                  <span className="text-muted-foreground">
                    {needsGrades ? "Pick at least one grade" : "Pick at least one teacher"}
                  </span>
                ) : preview === null ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CircleNotchIcon className="size-3.5 animate-spin" />
                    Working out who this reaches…
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-left"
                      onClick={() => setPreviewOpen((o) => !o)}
                    >
                      <span>
                        Reaches{" "}
                        {preview.count > 0 && (
                          <>
                            <span className="font-semibold">{preview.count}</span> teacher
                            {preview.count === 1 ? "" : "s"}
                          </>
                        )}
                        {preview.count > 0 && (preview.parent_count ?? 0) > 0 && " · "}
                        {(preview.parent_count ?? 0) > 0 && (
                          <>
                            <span className="font-semibold">{preview.parent_count}</span> parent
                            {preview.parent_count === 1 ? "" : "s"}
                          </>
                        )}
                        {reachTotal === 0 && <span className="text-muted-foreground">nobody yet</span>}
                      </span>
                      <span className="text-[11px] text-primary">{previewOpen ? "hide" : "show"}</span>
                    </button>
                    {(preview.parent_languages?.length ?? 0) > 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Will also be translated to{" "}
                        {(preview.parent_languages ?? [])
                          .map((l) => PARENT_LANGUAGE_LABEL[l] ?? l)
                          .join(", ")}
                        .
                      </p>
                    )}
                    {previewOpen && (
                      <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-muted-foreground">
                        {preview.teachers.map((t) => (
                          <li key={t.id} className="py-0.5">{t.full_name}</li>
                        ))}
                      </ul>
                    )}
                    {reachTotal === 0 && (
                      <p className="mt-1 text-xs text-destructive">
                        Nobody matches — {type === "parents" ? "add guardians on the students first" : "adjust the audience"}.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <Button className="hidden w-full lg:flex" onClick={() => void send()} disabled={!canSend}>
            {sending ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <PaperPlaneTiltIcon className="size-4" />
                Send
              </>
            )}
          </Button>
        </aside>

        {/* Mobile send — sits under the message, full width. */}
        <div className="lg:hidden">
          <Button className="w-full" size="lg" onClick={() => void send()} disabled={!canSend}>
            {sending ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <PaperPlaneTiltIcon className="size-4" />
                Send{reachTotal ? ` to ${reachTotal}` : ""}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
