import { useCallback, useEffect, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  BuildingsIcon,
  CircleNotchIcon,
  UserPlusIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { showError } from "@/lib/show-error"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

// ─────────────────────────────────────────────────────────────────────────────
// Platform Console · school overview — full page at
// /platform/schools/:schoolId. PaperHint team only; the API re-checks the
// role on every request.
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  timetable: "Timetable",
  calendar: "Academic calendar",
  copilot: "Ask Hint (copilot)",
  grading: "AI grading",
}

interface SchoolDetail {
  school: {
    id: string
    name: string
    board: { id: string; name: string } | null
    active_academic_year: string | null
    created_at: string
  }
  gateable_modules: string[]
  features: Record<string, boolean>
  plan_name: string | null
  valid_until: string | null
  notes: string | null
  admins: { id: string; full_name: string; email: string; status: string }[]
}

export function PlatformSchoolPage() {
  const { user } = useAuth()
  const { schoolId } = useParams<{ schoolId: string }>()

  const [detail, setDetail] = useState<SchoolDetail | null>(null)
  const [error, setError] = useState("")
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [planName, setPlanName] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [notes, setNotes] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [isInviting, setIsInviting] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    try {
      const res = await apiClient.get<SchoolDetail>(
        `/api/platform/schools/${schoolId}`
      )
      setDetail(res)
      setFeatures(res.features)
      setPlanName(res.plan_name ?? "")
      setValidUntil(res.valid_until ?? "")
      setNotes(res.notes ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    }
  }, [schoolId])

  useEffect(() => {
    if (user?.role === "platform") load()
  }, [user?.role, load])

  if (user && user.role !== "platform") return <Navigate to="/" replace />

  const saveLicense = async () => {
    setIsSaving(true)
    try {
      await apiClient.put(`/api/platform/schools/${schoolId}/features`, {
        features,
        plan_name: planName || null,
        valid_until: validUntil || null,
        notes: notes || null,
      })
      toast.success("License updated")
    } catch (err) {
      showError(err)
    } finally {
      setIsSaving(false)
    }
  }

  const inviteAdmin = async () => {
    if (!adminName.trim() || !adminEmail.trim()) {
      return showError(new Error("Admin name and email are required"))
    }
    setIsInviting(true)
    try {
      await apiClient.post(`/api/platform/schools/${schoolId}/admins`, {
        full_name: adminName.trim(),
        email: adminEmail.trim(),
      })
      toast.success("Admin invited — they'll get an email to set a password")
      setAdminName("")
      setAdminEmail("")
      load()
    } catch (err) {
      showError(err)
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <div
      className={cn(PAGE_GUTTER, PAGE_TOP, "flex min-h-full flex-col pb-12")}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <Link
            to="/platform"
            className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            Platform Console
          </Link>
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-sidebar">
              <BuildingsIcon className="size-5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-foreground">
                {detail?.school.name ?? "School"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {detail?.school.board?.name ?? "No board"}
                {detail?.school.active_academic_year &&
                  ` · AY ${detail.school.active_academic_year}`}
                {detail &&
                  ` · created ${new Date(detail.school.created_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !detail ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : (
          <>
            {/* License */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Module license
              </p>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {detail.gateable_modules.map((m) => (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3"
                  >
                    <Checkbox
                      checked={features[m] !== false}
                      onCheckedChange={(v) =>
                        setFeatures((prev) => ({ ...prev, [m]: !!v }))
                      }
                    />
                    <span className="text-sm text-secondary-foreground">
                      {MODULE_LABELS[m] ?? m}
                    </span>
                    {features[m] === false && (
                      <Badge
                        variant="outline"
                        className="ml-auto rounded-full text-[10px] text-destructive"
                      >
                        disabled
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Plan name</Label>
                  <Input
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="e.g. Pilot, Standard"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Valid until</Label>
                  <DatePickerField
                    value={validUntil}
                    onChange={setValidUntil}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Notes (internal)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Billing contact, agreed price, anything the team should know."
                />
              </div>
              <Button
                onClick={saveLicense}
                disabled={isSaving}
                className="self-end"
              >
                {isSaving ? (
                  <CircleNotchIcon className="size-4 animate-spin" />
                ) : (
                  "Save license"
                )}
              </Button>
            </div>

            {/* Admins */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                School admins
              </p>
              {detail.admins.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No admins yet — invite the first one below.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {detail.admins.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {a.full_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.email}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[10px]"
                      >
                        {a.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Full name"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={inviteAdmin}
                  disabled={isInviting}
                  className="self-end"
                >
                  {isInviting ? (
                    <CircleNotchIcon className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <UserPlusIcon className="size-3.5" />
                      Invite admin
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
