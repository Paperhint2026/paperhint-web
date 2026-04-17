import { useEffect, useRef, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  CalendarIcon,
  CameraIcon,
  Loader2Icon,
  LinkIcon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { format } from "date-fns"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

export interface ClassSubjectOption {
  subjectId: string
  subjectName: string
  classSubjectId: string
}

export interface ClassSubjectEntry {
  classId: string
  classSubjectId: string
}

export interface ExistingAssignment {
  classSubjectId: string
  className: string
  subjectName: string
}

export interface TeacherFormData {
  fullName: string
  email: string
  phone: string
  profileUrl: string
  departmentId: string
  designation: string
  dateOfJoining: Date | undefined
  classSubjects: ClassSubjectEntry[]
  existingAssignments: ExistingAssignment[]
  pendingProfileFile?: File
}

export interface AddTeacherDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: TeacherFormData) => void
  onDisassociate?: (teacherId: string, classSubjectId: string) => Promise<void>
  teacherId?: string | null
  departments: { value: string; label: string }[]
  classes: { value: string; label: string }[]
  fetchSubjectsForClass: (classId: string) => Promise<ClassSubjectOption[]>
  isSaving?: boolean
  editData?: TeacherFormData | null
}

const emptyForm: TeacherFormData = {
  fullName: "",
  email: "",
  phone: "",
  profileUrl: "",
  departmentId: "",
  designation: "",
  dateOfJoining: undefined,
  classSubjects: [{ classId: "", classSubjectId: "" }],
  existingAssignments: [],
}


export function AddTeacherDrawer({
  open,
  onOpenChange,
  onSave,
  onDisassociate,
  teacherId,
  departments,
  classes,
  fetchSubjectsForClass,
  isSaving = false,
  editData = null,
}: AddTeacherDrawerProps) {
  const isEditMode = !!editData
  const isMobile = useIsMobile()
  const [form, setForm] = useState<TeacherFormData>({ ...emptyForm })
  const [previewSrc, setPreviewSrc] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const [subjectsByClass, setSubjectsByClass] = useState<
    Record<string, ClassSubjectOption[]>
  >({})
  const [loadingSubjects, setLoadingSubjects] = useState<
    Record<string, boolean>
  >({})
  const [confirmDisassociate, setConfirmDisassociate] =
    useState<ExistingAssignment | null>(null)
  const [isDisassociating, setIsDisassociating] = useState(false)

  useEffect(() => {
    if (open && editData) {
      setForm({ ...editData })
      setPreviewSrc(editData.profileUrl || "")
      const classIds = editData.classSubjects
        .map((cs) => cs.classId)
        .filter(Boolean)
      const uniqueClassIds = [...new Set(classIds)]
      uniqueClassIds.forEach(async (classId) => {
        if (subjectsByClass[classId]) return
        setLoadingSubjects((prev) => ({ ...prev, [classId]: true }))
        try {
          const subjects = await fetchSubjectsForClass(classId)
          setSubjectsByClass((prev) => ({ ...prev, [classId]: subjects }))
        } catch {
          setSubjectsByClass((prev) => ({ ...prev, [classId]: [] }))
        } finally {
          setLoadingSubjects((prev) => ({ ...prev, [classId]: false }))
        }
      })
    } else if (open && !editData) {
      setForm({ ...emptyForm })
      setPreviewSrc("")
    }
  }, [open, editData])

  const handleDisassociate = async () => {
    if (!confirmDisassociate || !teacherId || !onDisassociate) return
    setIsDisassociating(true)
    try {
      await onDisassociate(teacherId, confirmDisassociate.classSubjectId)
      setForm((prev) => ({
        ...prev,
        existingAssignments: prev.existingAssignments.filter(
          (a) => a.classSubjectId !== confirmDisassociate.classSubjectId,
        ),
      }))
    } catch (err) {
      console.error("Failed to disassociate:", err)
    } finally {
      setIsDisassociating(false)
      setConfirmDisassociate(null)
    }
  }

  const updateField = <K extends keyof TeacherFormData>(
    key: K,
    value: TeacherFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPreviewSrc(URL.createObjectURL(file))

    if (!teacherId) {
      setForm((prev) => ({ ...prev, pendingProfileFile: file, profileUrl: "" }))
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("image", file)
      formData.append("user_id", teacherId)

      const token = localStorage.getItem("access_token")
      const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

      const res = await fetch(`${BASE_URL}/api/auth/upload-profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")

      const data = (await res.json()) as { preview_url: string }
      setForm((prev) => ({ ...prev, profileUrl: data.preview_url }))
    } catch (err) {
      console.error("Profile upload failed:", err)
      setPreviewSrc("")
      setForm((prev) => ({ ...prev, profileUrl: "" }))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleClassChange = async (index: number, classId: string) => {
    setForm((prev) => {
      const updated = [...prev.classSubjects]
      updated[index] = { classId, classSubjectId: "" }
      return { ...prev, classSubjects: updated }
    })

    if (subjectsByClass[classId]) return

    setLoadingSubjects((prev) => ({ ...prev, [classId]: true }))
    try {
      const subjects = await fetchSubjectsForClass(classId)
      setSubjectsByClass((prev) => ({ ...prev, [classId]: subjects }))
    } catch {
      setSubjectsByClass((prev) => ({ ...prev, [classId]: [] }))
    } finally {
      setLoadingSubjects((prev) => ({ ...prev, [classId]: false }))
    }
  }

  const handleSubjectChange = (index: number, classSubjectId: string) => {
    setForm((prev) => {
      const updated = [...prev.classSubjects]
      updated[index] = { ...updated[index], classSubjectId }
      return { ...prev, classSubjects: updated }
    })
  }

  const removeClassSubjectRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      classSubjects: prev.classSubjects.filter((_, i) => i !== index),
    }))
  }

  const addClassSubjectRow = () => {
    setForm((prev) => ({
      ...prev,
      classSubjects: [
        ...prev.classSubjects,
        { classId: "", classSubjectId: "" },
      ],
    }))
    requestAnimationFrame(() => {
      const el = bodyScrollRef.current
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
      }
    })
  }

  const isFormValid =
    form.fullName.trim() !== "" &&
    form.email.trim() !== "" &&
    form.departmentId !== ""

  const handleSave = () => {
    onSave(form)
    setForm({ ...emptyForm })
    setPreviewSrc("")
    setConfirmDisassociate(null)
  }

  const handleClose = () => {
    onOpenChange(false)
    setForm({ ...emptyForm })
    setPreviewSrc("")
    setConfirmDisassociate(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} size={isMobile ? "full" : "xl"} showCloseButton={false} className="flex h-full w-full flex-col p-0">
        {/* Header */}
        <SheetHeader className="border-b bg-muted/50 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base font-medium text-secondary-foreground">
                {isEditMode ? "Edit Teacher" : "Add New Teacher"}
              </SheetTitle>
              <SheetDescription>
                {isEditMode
                  ? "Update the teacher's details."
                  : "Fill in the details to add a new teacher."}
              </SheetDescription>
            </div>
            <SheetClose asChild>
              <button
                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <XIcon className="size-5" />
              </button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Body */}
        <div ref={bodyScrollRef} className="no-scrollbar flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
            {/* Basic Info */}
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Basic Info</p>

            {/* Avatar + Full Name */}
            <div className="flex items-end gap-4">
              <div
                className="group/avatar relative flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-muted-foreground/50"
                onClick={() => !previewSrc && fileInputRef.current?.click()}
              >
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <CameraIcon className="size-5 text-muted-foreground" />
                )}
                {previewSrc && !isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-background/60 opacity-0 transition-opacity group-hover/avatar:opacity-100 [@media(hover:none)]:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      className="flex size-6 items-center justify-center rounded-full bg-background text-foreground shadow hover:bg-muted"
                      aria-label="Change photo"
                    >
                      <PencilIcon className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewSrc("")
                        updateField("profileUrl", "")
                      }}
                      className="flex size-6 items-center justify-center rounded-full bg-background text-destructive shadow hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Remove photo"
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <Loader2Icon className="size-4 animate-spin" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <Label className="text-sm">Teacher&apos;s Full Name <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Sarah Johnson"
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Work Email Address <span className="text-destructive">*</span></Label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Enter Work Email Address"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  disabled={isEditMode}
                />
              </div>
              {!isEditMode && (
                <p className="text-xs text-muted-foreground">
                  An invite email will be sent to this address.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Phone Number</Label>
              <div className="relative">
                <PhoneIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Enter Phone Number"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Professional Details */}
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Professional Details</p>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Department <span className="text-destructive">*</span></Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => updateField("departmentId", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label className="text-sm">Designation</Label>
                <Input
                  placeholder="e.g. Senior Teacher, Asst. Professor"
                  value={form.designation}
                  onChange={(e) => updateField("designation", e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label className="text-sm">Date of Joining</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      data-empty={!form.dateOfJoining}
                      className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
                    >
                      <CalendarIcon className="size-4" />
                      {form.dateOfJoining
                        ? format(form.dateOfJoining, "PPP")
                        : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.dateOfJoining}
                      onSelect={(d) => updateField("dateOfJoining", d)}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            {/* Classes & Subjects */}
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Classes & Subjects</p>
            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? "Manage class-subject assignments for this teacher."
                : "Optionally assign this teacher to class-subject combinations."}
            </p>

            {/* Existing assignments (edit mode) */}
            {isEditMode && form.existingAssignments.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-muted-foreground">
                  Current Assignments
                </Label>
                <div className="flex flex-wrap gap-2">
                  {form.existingAssignments.map((a) => (
                    <div
                      key={a.classSubjectId}
                      className="inline-flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs"
                    >
                      <LinkIcon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-secondary-foreground">
                        {a.className}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {a.subjectName}
                      </span>
                      <button
                        className="ml-1 flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setConfirmDisassociate(a)}
                        title="Disassociate"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm disassociate modal */}
            <AlertDialog
              open={!!confirmDisassociate}
              onOpenChange={(open) => {
                if (!open) setConfirmDisassociate(null)
              }}
            >
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Disassociate Assignment</AlertDialogTitle>
                  <AlertDialogDescription>
                    This teacher is assigned to{" "}
                    <span className="font-semibold text-secondary-foreground">
                      {confirmDisassociate?.className}
                    </span>{" "}
                    for{" "}
                    <span className="font-semibold text-secondary-foreground">
                      {confirmDisassociate?.subjectName}
                    </span>
                    . Do you want to disassociate?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={isDisassociating}
                    onClick={handleDisassociate}
                  >
                    {isDisassociating && (
                      <Loader2Icon className="size-3 animate-spin" />
                    )}
                    Yes, Disassociate
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* New assignments */}
            {isEditMode && (
              <Label className="text-xs text-muted-foreground">
                Add New Assignment
              </Label>
            )}

            <div className="flex flex-col gap-3">
              {form.classSubjects.map((entry, index) => {
                const availableSubjects = entry.classId
                  ? subjectsByClass[entry.classId] ?? []
                  : []
                const isLoadingSubs = entry.classId
                  ? loadingSubjects[entry.classId] ?? false
                  : false

                const isFirst = index === 0
                return (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex flex-1 flex-col gap-2">
                      {isFirst && <Label className="text-xs">Class</Label>}
                      <Select
                        value={entry.classId}
                        onValueChange={(v) => handleClassChange(index, v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      {isFirst && <Label className="text-xs">Subject</Label>}
                      {isLoadingSubs ? (
                        <div className="h-9 animate-pulse rounded-4xl bg-muted" />
                      ) : (
                        <Select
                          disabled={!entry.classId || availableSubjects.length === 0}
                          value={entry.classSubjectId}
                          onValueChange={(v) => handleSubjectChange(index, v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                !entry.classId
                                  ? "Select class first"
                                  : availableSubjects.length === 0
                                    ? "No subjects"
                                    : "Select subject"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSubjects.map((sub) => (
                              <SelectItem
                                key={sub.classSubjectId}
                                value={sub.classSubjectId}
                              >
                                {sub.subjectName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-40"
                      onClick={() => removeClassSubjectRow(index)}
                      disabled={form.classSubjects.length === 1}
                      aria-label="Remove row"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                )
              })}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addClassSubjectRow}
                >
                  <PlusIcon className="size-4" />
                  Add More
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="flex-col border-t bg-muted/50 px-4 py-3 sm:px-6 sm:py-4">
          <Button
            size="lg"
            className="w-full"
            disabled={!isFormValid || isSaving}
            onClick={handleSave}
          >
            {isSaving && <Loader2Icon className="animate-spin" />}
            {isSaving
              ? isEditMode
                ? "Saving..."
                : "Sending Invite..."
              : isEditMode
                ? "Save Changes"
                : "Add Teacher"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleClose}
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
