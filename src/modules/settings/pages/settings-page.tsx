import { useRef, useState } from "react"
import dayjs from "dayjs"
import {
  BadgeCheckIcon,
  CalendarIcon,
  CameraIcon,
  KeyIcon,
  Loader2Icon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react"

import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { useAppDispatch } from "@/store"
import { updateUser } from "@/store/auth-slice"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function SettingsPage() {
  const { user } = useAuth()
  const dispatch = useAppDispatch()

  const [fullName, setFullName] = useState(user?.full_name ?? "")
  const [phone, setPhone] = useState(user?.phone_number ?? "")
  const [designation] = useState(user?.designation ?? "")
  const [dateOfJoining, setDateOfJoining] = useState<Date | undefined>(
    user?.date_of_joining ? new Date(user.date_of_joining) : undefined,
  )
  const [profileUrl, setProfileUrl] = useState(user?.profile_url ?? "")
  const [previewSrc, setPreviewSrc] = useState(user?.profile_url ?? "")

  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
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
    } catch {
      setPreviewSrc(profileUrl)
      toast.error("Failed to upload photo. Please try again.")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setIsSaving(true)
    try {
      await apiClient.put(`/api/auth/teacher/${user.id}`, {
        full_name: fullName,
        designation: designation || undefined,
        phone_number: phone || undefined,
        date_of_joining: dateOfJoining
          ? dayjs(dateOfJoining).valueOf()
          : undefined,
        profile_url: profileUrl || undefined,
      })
      dispatch(
        updateUser({
          full_name: fullName,
          designation,
          phone_number: phone,
          date_of_joining: dateOfJoining
            ? dayjs(dateOfJoining).valueOf()
            : undefined,
          profile_url: profileUrl,
        }),
      )
      toast.success("Profile updated successfully")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save profile",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    setIsResetting(true)
    try {
      await apiClient.post("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change password",
      )
    } finally {
      setIsResetting(false)
    }
  }

  if (!user) return null

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        {/* Profile Card */}
        <div className="flex flex-col gap-6 rounded-xl border bg-background p-6">
          <div className="flex items-center gap-2">
            <UserIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-secondary-foreground">
              Profile
            </h2>
          </div>

          {/* Avatar + Upload */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="size-20 ring-2 ring-muted">
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
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                  <Loader2Icon className="size-5 animate-spin" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <CameraIcon className="size-4" />
                {isUploading ? "Uploading..." : "Change Photo"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Recommended: 200 × 200px. JPG, PNG or WebP.
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

          <Separator />

          {/* Form fields */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Email</Label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={user.email}
                  disabled
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Phone Number</Label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                  type="tel"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Designation</Label>
              <div className="relative">
                <BadgeCheckIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={designation}
                  disabled
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Date of Joining</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateOfJoining && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="size-4" />
                    {dateOfJoining
                      ? dayjs(dateOfJoining).format("MM/DD/YYYY")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="border-b p-3">
                    <Input
                      type="date"
                      value={
                        dateOfJoining
                          ? dayjs(dateOfJoining).format("YYYY-MM-DD")
                          : ""
                      }
                      onChange={(e) => {
                        const d = e.target.value
                          ? new Date(e.target.value + "T00:00:00")
                          : undefined
                        setDateOfJoining(d)
                      }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Calendar
                    mode="single"
                    selected={dateOfJoining}
                    onSelect={(d) => setDateOfJoining(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <div className="relative">
                <ShieldIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 capitalize"
                  value={user.role ?? ""}
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Save button */}
          <div>
            <Button
              disabled={isSaving || !fullName.trim()}
              onClick={handleSaveProfile}
            >
              {isSaving && (
                <Loader2Icon className="size-4 animate-spin" />
              )}
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="flex flex-col gap-6 rounded-xl border bg-background p-6">
          <div className="flex items-center gap-2">
            <KeyIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-secondary-foreground">
              Change Password
            </h2>
          </div>

          <div className="flex max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <div>
              <Button
                disabled={
                  isResetting ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                onClick={handleResetPassword}
              >
                {isResetting && (
                  <Loader2Icon className="size-4 animate-spin" />
                )}
                {isResetting ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
