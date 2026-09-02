import { useRef, useState } from "react"
import dayjs from "dayjs"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  CalendarBlankIcon,
  CameraIcon,
  CheckIcon,
  CircleNotchIcon,
  LockSimpleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAppDispatch } from "@/store"
import { updateUser, type User } from "@/store/auth-slice"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  SectionMotion,
  SettingsCard,
  SettingsRow,
} from "@/modules/settings/components/settings-primitives"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/** A read-only value shown where an input would be, so the row still lines up. */
function ReadOnlyValue({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-3 text-sm text-muted-foreground",
        className
      )}
    >
      <LockSimpleIcon className="size-3.5 shrink-0" />
      <span className="truncate">{value || "—"}</span>
    </div>
  )
}

export function ProfileSection({ user }: { user: User }) {
  const dispatch = useAppDispatch()
  const reduceMotion = useReducedMotion()

  const [fullName, setFullName] = useState(user.full_name ?? "")
  const [phone, setPhone] = useState(user.phone_number ?? "")
  const [dateOfJoining, setDateOfJoining] = useState<Date | undefined>(
    user.date_of_joining ? new Date(user.date_of_joining) : undefined
  )
  const [profileUrl, setProfileUrl] = useState(user.profile_url ?? "")
  const [previewSrc, setPreviewSrc] = useState(user.profile_url ?? "")

  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dirty = anything differs from what the store holds. The save bar shows
  // itself from this alone, so there is no separate "edited" flag to keep.
  const savedJoin = user.date_of_joining
    ? dayjs(user.date_of_joining).format("YYYY-MM-DD")
    : ""
  const draftJoin = dateOfJoining
    ? dayjs(dateOfJoining).format("YYYY-MM-DD")
    : ""
  const isDirty =
    fullName.trim() !== (user.full_name ?? "").trim() ||
    (phone ?? "") !== (user.phone_number ?? "") ||
    draftJoin !== savedJoin
  const canSave = isDirty && fullName.trim().length > 0 && !isSaving

  const discard = () => {
    setFullName(user.full_name ?? "")
    setPhone(user.phone_number ?? "")
    setDateOfJoining(
      user.date_of_joining ? new Date(user.date_of_joining) : undefined
    )
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPreviewSrc(URL.createObjectURL(file))
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("image", file)
      const token = localStorage.getItem("access_token")
      const BASE_URL = import.meta.env.VITE_API_BASE_URL as string
      const res = await fetch(`${BASE_URL}/api/auth/upload-profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error("Upload failed")
      const data = (await res.json()) as { preview_url: string }
      setProfileUrl(data.preview_url)
      setPreviewSrc(data.preview_url)
      dispatch(updateUser({ profile_url: data.preview_url }))
      toast.success("Photo updated")
    } catch {
      setPreviewSrc(profileUrl)
      toast.error("Failed to upload photo. Please try again.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const joinMs = dateOfJoining ? dayjs(dateOfJoining).valueOf() : undefined
      await apiClient.put(`/api/auth/teacher/${user.id}`, {
        full_name: fullName.trim(),
        designation: user.designation || undefined,
        phone_number: phone || undefined,
        date_of_joining: joinMs,
        profile_url: profileUrl || undefined,
      })
      dispatch(
        updateUser({
          full_name: fullName.trim(),
          phone_number: phone,
          date_of_joining: joinMs,
          profile_url: profileUrl,
        })
      )
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 1600)
      toast.success("Profile updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SectionMotion>
      {/* ── Identity ── */}
      <SettingsCard
        title="Photo"
        description="Shown beside your name across the school."
      >
        <div className="flex items-center gap-5 px-5 py-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            aria-label="Change photo"
            className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Avatar className="size-20 ring-2 ring-border transition-[box-shadow] group-hover:ring-primary/40">
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={user.full_name}
                  className="aspect-square size-full rounded-full object-cover"
                />
              ) : (
                <AvatarFallback className="text-xl">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              )}
            </Avatar>
            {/* Hover veil with the camera: the whole photo is the control. */}
            <span
              className={cn(
                "absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white transition-opacity",
                isUploading
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              )}
            >
              {isUploading ? (
                <CircleNotchIcon className="size-5 animate-spin" />
              ) : (
                <CameraIcon className="size-5" />
              )}
            </span>
          </button>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <CameraIcon className="size-4" />
                {isUploading ? "Uploading…" : "Upload photo"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Square works best, at least 200 × 200px. JPG, PNG or WebP.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>
        </div>
      </SettingsCard>

      {/* ── Details ── */}
      <SettingsCard
        title="Personal details"
        description="How you appear to students, parents and colleagues."
      >
        <SettingsRow
          label="Full name"
          hint="Printed on question papers and report cards."
          htmlFor="settings-full-name"
        >
          <Input
            id="settings-full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            aria-invalid={fullName.trim().length === 0 || undefined}
          />
        </SettingsRow>
        <SettingsRow
          label="Phone number"
          hint="Only your school's admins can see this."
          htmlFor="settings-phone"
        >
          <Input
            id="settings-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Add a phone number"
          />
        </SettingsRow>
        <SettingsRow
          label="Date of joining"
          hint="When you started at this school."
        >
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start font-normal",
                  !dateOfJoining && "text-muted-foreground"
                )}
              >
                <CalendarBlankIcon className="size-4" />
                {dateOfJoining
                  ? dayjs(dateOfJoining).format("D MMMM YYYY")
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateOfJoining}
                onSelect={(d) => setDateOfJoining(d)}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </SettingsRow>
      </SettingsCard>

      {/* ── Managed by the school ── */}
      <SettingsCard
        title="School record"
        description="Set by your school's admin. Ask them if something here is wrong."
      >
        <SettingsRow label="Email" hint="Used to sign in.">
          <ReadOnlyValue value={user.email} />
        </SettingsRow>
        <SettingsRow label="Designation">
          <ReadOnlyValue value={user.designation ?? ""} />
        </SettingsRow>
        <SettingsRow label="Role">
          <ReadOnlyValue value={user.role ?? ""} className="capitalize" />
        </SettingsRow>
      </SettingsCard>

      {/* ── Unsaved changes bar ── */}
      {/* Sticky to the scroller's bottom edge: it rises into view the moment
          a field differs from what is saved, and leaves once it matches again. */}
      <AnimatePresence>
        {isDirty ? (
          <motion.div
            key="save-bar"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur"
          >
            <span className="flex items-center gap-2 text-sm text-foreground">
              <span
                aria-hidden
                className="size-2 rounded-full bg-amber-500 dark:bg-amber-400"
              />
              You have unsaved changes
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={discard}
                disabled={isSaving}
              >
                Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!canSave}>
                {isSaving ? (
                  <CircleNotchIcon className="size-4 animate-spin" />
                ) : justSaved ? (
                  <CheckIcon className="size-4" />
                ) : null}
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </SectionMotion>
  )
}
