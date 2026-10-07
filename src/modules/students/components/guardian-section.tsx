import { useEffect, useState } from "react"
import { CircleNotchIcon, PlusIcon, TrashIcon, WhatsappLogoIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { showError } from "@/lib/show-error"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface Guardian {
  id: string
  student_id: string
  full_name: string
  relationship: "father" | "mother" | "guardian"
  phone: string | null
  email: string | null
  preferred_language: string
  whatsapp_opt_in: boolean
  notify_email: boolean
}

const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "mr", label: "Marathi" },
  { value: "bn", label: "Bengali" },
  { value: "gu", label: "Gujarati" },
  { value: "pa", label: "Punjabi" },
  { value: "or", label: "Odia" },
  { value: "as", label: "Assamese" },
  { value: "ur", label: "Urdu" },
]

const RELATIONSHIPS = ["father", "mother", "guardian"] as const

/**
 * Parent/guardian contacts on a student (migration 053) — phone-first, with
 * the preferred language that drives per-language circular translations.
 * Contacts only; the parent portal login is v2.
 */
export function GuardianSection({
  studentId,
  canManage,
}: {
  studentId: string
  canManage: boolean
}) {
  const [guardians, setGuardians] = useState<Guardian[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({
    full_name: "",
    relationship: "father" as (typeof RELATIONSHIPS)[number],
    phone: "",
    preferred_language: "en",
    whatsapp_opt_in: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setGuardians(null)
    apiClient
      .get<{ guardians: Guardian[] }>(`/api/guardians?student_id=${studentId}`)
      .then((r) => {
        if (!cancelled) setGuardians(r.guardians ?? [])
      })
      .catch(() => {
        if (!cancelled) setGuardians([])
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  const add = async () => {
    if (!draft.full_name.trim() || saving) return
    setSaving(true)
    try {
      const r = await apiClient.post<{ guardian: Guardian }>("/api/guardians", {
        student_id: studentId,
        ...draft,
        full_name: draft.full_name.trim(),
        phone: draft.phone.trim() || undefined,
      })
      setGuardians((cur) => [...(cur ?? []), r.guardian])
      setDraft({ full_name: "", relationship: "father", phone: "", preferred_language: "en", whatsapp_opt_in: true })
      setAdding(false)
      toast.success("Guardian added")
    } catch (err) {
      showError(err, "Couldn't add the guardian")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (g: Guardian) => {
    try {
      await apiClient.delete(`/api/guardians/${g.id}`)
      setGuardians((cur) => (cur ?? []).filter((x) => x.id !== g.id))
    } catch (err) {
      showError(err, "Couldn't remove the guardian")
    }
  }

  const langLabel = (v: string) => LANGUAGES.find((l) => l.value === v)?.label ?? v

  return (
    <div className="flex flex-col gap-3">
      {guardians === null ? (
        <div className="h-16 animate-pulse rounded-xl border border-dashed border-border" />
      ) : guardians.length === 0 && !adding ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-secondary-foreground">No parent contacts yet</p>
            <p className="text-xs text-muted-foreground">
              {canManage
                ? "Add a parent so circulars and updates can reach them on WhatsApp."
                : "None recorded for this student."}
            </p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <PlusIcon className="size-3.5" />
              Add
            </Button>
          )}
        </div>
      ) : (
        <>
          {guardians.length > 0 && (
            <ul className="flex flex-col divide-y rounded-xl border">
              {guardians.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {g.full_name}{" "}
                      <span className="font-normal text-muted-foreground">· {g.relationship}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {g.phone || "no phone"} · {langLabel(g.preferred_language)}
                      {g.whatsapp_opt_in && (
                        <WhatsappLogoIcon className="ml-1 inline size-3.5 align-text-bottom text-primary" />
                      )}
                    </p>
                  </div>
                  {g.phone && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`tel:${g.phone}`}>Call</a>
                    </Button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      aria-label={`Remove ${g.full_name}`}
                      onClick={() => void remove(g)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && !adding && guardians.length < 4 && (
            <Button size="sm" variant="outline" className="self-start" onClick={() => setAdding(true)}>
              <PlusIcon className="size-3.5" />
              Add guardian
            </Button>
          )}
        </>
      )}

      {adding && (
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={draft.full_name}
                maxLength={120}
                placeholder="e.g. Ravi Sharma"
                onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Relationship</Label>
              <Select
                value={draft.relationship}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, relationship: v as (typeof RELATIONSHIPS)[number] }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r[0].toUpperCase() + r.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Phone (WhatsApp)</Label>
              <Input
                value={draft.phone}
                inputMode="tel"
                placeholder="+91 98xxxxxx01"
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Preferred language</Label>
              <Select
                value={draft.preferred_language}
                onValueChange={(v) => setDraft((d) => ({ ...d, preferred_language: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={draft.whatsapp_opt_in}
              onCheckedChange={(v) => setDraft((d) => ({ ...d, whatsapp_opt_in: !!v }))}
            />
            Okay to message on WhatsApp
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void add()} disabled={!draft.full_name.trim() || saving}>
              {saving ? <CircleNotchIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
              Save guardian
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
