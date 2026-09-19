import { useEffect, useState } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import {
  ArrowLeftIcon,
  BuildingsIcon,
  CircleNotchIcon,
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─────────────────────────────────────────────────────────────────────────────
// Platform Console · new school — full-page provisioning at
// /platform/schools/new: identity, license, and the first admin in one
// submit. PaperHint team only.
// ─────────────────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  timetable: "Timetable",
  calendar: "Academic calendar",
  copilot: "Ask Hint (copilot)",
  grading: "AI grading",
}
const GATEABLE = Object.keys(MODULE_LABELS)

export function PlatformSchoolNewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [boardId, setBoardId] = useState("")
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([])
  const [features, setFeatures] = useState<Record<string, boolean>>(
    Object.fromEntries(GATEABLE.map((m) => [m, true]))
  )
  const [planName, setPlanName] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [notes, setNotes] = useState("")
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user?.role !== "platform") return
    apiClient
      .get<{ boards: { id: string; name: string }[] }>("/api/platform/boards")
      .then((res) => setBoards(res.boards ?? []))
      .catch(() => setBoards([]))
  }, [user?.role])

  if (user && user.role !== "platform") return <Navigate to="/" replace />

  const create = async () => {
    if (!name.trim()) return showError(new Error("Give the school a name"))
    if ((adminName.trim() === "") !== (adminEmail.trim() === "")) {
      return showError(
        new Error("Admin needs both a name and an email — or leave both empty")
      )
    }
    setIsSaving(true)
    try {
      const res = await apiClient.post<{
        school: { id: string }
        admin: { id: string } | null
        admin_error: string | null
      }>("/api/platform/schools", {
        name: name.trim(),
        board_id: boardId || null,
        features,
        plan_name: planName || null,
        valid_until: validUntil || null,
        notes: notes || null,
        admin: adminEmail.trim()
          ? { full_name: adminName.trim(), email: adminEmail.trim() }
          : null,
      })
      if (res.admin_error) {
        toast.warning(
          `School created, but the admin invite failed: ${res.admin_error}. Retry from the school page.`
        )
      } else {
        toast.success(
          res.admin
            ? "School created — the admin got an invite email"
            : "School created"
        )
      }
      navigate(`/platform/schools/${res.school.id}`, { replace: true })
    } catch (err) {
      showError(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className={cn(PAGE_GUTTER, PAGE_TOP, "flex min-h-full flex-col pb-12")}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                New school
              </h1>
              <p className="text-sm text-muted-foreground">
                Identity, license, and the first admin — provisioned in one go.
              </p>
            </div>
          </div>
        </div>

        {/* Identity */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            School
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                School name <span className="text-destructive">*</span>
              </Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. St. Mary's Matriculation"
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Board</Label>
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a board" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* License */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Module license
          </p>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {GATEABLE.map((m) => (
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
                  {MODULE_LABELS[m]}
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
        </div>

        {/* First admin */}
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-5">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              First admin
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional — they get an invite email to set a password. You can
              also invite admins later from the school page.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Full name</Label>
              <Input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Ramachandran"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@school.edu"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/platform")}>
            Cancel
          </Button>
          <Button onClick={create} disabled={isSaving}>
            {isSaving ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create school"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
