import { useEffect, useMemo, useRef, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  CalendarIcon,
  CameraIcon,
  CaretRightIcon,
  CircleNotchIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { toast } from "sonner"

import { describeGrades, GRADES, gradeLabel } from "@/lib/grades"
import { cn } from "@/lib/utils"
import {
  CustomFieldsInputs,
  defsForSection,
  missingRequiredCustomFields,
  useCustomFieldDefs,
  type CustomFieldValues,
} from "@/components/shared/custom-fields"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CurlyDivider } from "@/components/shared/curly-divider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** A subject this teacher could teach: the grades it runs in (to filter it
 * by the grade picked first) and the department(s) it belongs to — a
 * subject can legitimately have more than one (docs/truth.md). */
export interface TeachableSubjectOption {
  id: string
  subjectName: string
  grades: number[]
  departmentIds: string[]
}

export interface TeacherFormData {
  fullName: string
  email: string
  phone: string
  profileUrl: string
  designation: string
  dateOfJoining: Date | undefined
  /** What this teacher can teach — mandatory. The department is derived
   * server-side from whichever of these is primary. Which specific
   * class/section they're assigned to is the timetable's job, not this
   * form's (founder, 2026-09-15: "class... can be auto assigned from
   * timetable... when configured" — picking it here too was two
   * repetitive fields doing the same selection). */
  subjectIds: string[]
  primarySubjectId: string
  /** Grades this teacher can teach — a capability, not a timetable slot. */
  teachableGrades: number[]
  pendingProfileFile?: File
  customFields?: CustomFieldValues
}

export interface AddTeacherDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: TeacherFormData) => void
  teacherId?: string | null
  subjects: TeachableSubjectOption[]
  departmentNameById: Record<string, string>
  isSaving?: boolean
  editData?: TeacherFormData | null
}

const emptyForm: TeacherFormData = {
  fullName: "",
  email: "",
  phone: "",
  profileUrl: "",
  designation: "",
  dateOfJoining: undefined,
  subjectIds: [],
  primarySubjectId: "",
  teachableGrades: [],
  customFields: {},
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function AddTeacherDrawer({
  open,
  onOpenChange,
  onSave,
  teacherId,
  subjects,
  departmentNameById,
  isSaving = false,
  editData = null,
}: AddTeacherDrawerProps) {
  const isEditMode = !!editData
  const isMobile = useIsMobile()
  const [form, setForm] = useState<TeacherFormData>({ ...emptyForm })
  const [previewSrc, setPreviewSrc] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false)
  const [subjectQuery, setSubjectQuery] = useState("")

  useEffect(() => {
    if (open && editData) {
      setForm({ ...editData })
      setPreviewSrc(editData.profileUrl || "")
    } else if (open && !editData) {
      setForm({ ...emptyForm })
      setPreviewSrc("")
    }
  }, [open, editData])

  const updateField = <K extends keyof TeacherFormData>(
    key: K,
    value: TeacherFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  )

  const addSubject = (subjectId: string) => {
    setForm((prev) => ({
      ...prev,
      subjectIds: [...prev.subjectIds, subjectId],
      // The first subject picked defaults to primary; picking more doesn't
      // change it until the admin explicitly sets a different one.
      primarySubjectId: prev.primarySubjectId || subjectId,
    }))
    setSubjectPickerOpen(false)
    setSubjectQuery("")
  }

  const removeSubject = (subjectId: string) => {
    setForm((prev) => {
      const subjectIds = prev.subjectIds.filter((id) => id !== subjectId)
      return {
        ...prev,
        subjectIds,
        primarySubjectId:
          prev.primarySubjectId === subjectId
            ? (subjectIds[0] ?? "")
            : prev.primarySubjectId,
      }
    })
  }

  // One of many possible departments when the primary subject itself
  // belongs to several — same "first wins" rule the server applies.
  const derivedDepartmentName = (() => {
    const primary = subjectById.get(form.primarySubjectId)
    const deptId = primary?.departmentIds[0]
    return deptId ? (departmentNameById[deptId] ?? null) : null
  })()

  const availableSubjects = subjects
    .filter((s) => !form.subjectIds.includes(s.id))
    // The grade picked above narrows this — nothing picked yet means
    // nothing to narrow by (founder, 2026-09-15: "each item selected will
    // be subset filtering the next").
    .filter(
      (s) =>
        form.teachableGrades.length === 0 ||
        s.grades.some((g) => form.teachableGrades.includes(g))
    )
    .filter((s) =>
      subjectQuery.trim()
        ? s.subjectName
            .toLowerCase()
            .includes(subjectQuery.trim().toLowerCase())
        : true
    )

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

  const customDefs = useCustomFieldDefs("teacher")
  const customSection = (section: string) => {
    const defs = defsForSection(customDefs, section)
    if (defs.length === 0) return null
    return (
      <CustomFieldsInputs
        defs={defs}
        values={form.customFields ?? {}}
        onChange={(next) =>
          setForm((prev) => ({ ...prev, customFields: next }))
        }
      />
    )
  }

  const isFormValid =
    form.fullName.trim() !== "" &&
    form.email.trim() !== "" &&
    form.subjectIds.length > 0 &&
    form.primarySubjectId !== ""

  // Hand the form to the parent as-is. The parent owns the API call: on
  // success it closes the drawer; on failure it toasts and leaves the drawer
  // open with every field intact so the admin can correct and retry.
  const handleSave = () => {
    const missing = missingRequiredCustomFields(
      customDefs,
      form.customFields ?? {}
    )
    if (missing.length > 0) {
      toast.error(
        `Fill the required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`
      )
      return
    }
    onSave(form)
  }

  const handleClose = () => {
    onOpenChange(false)
    setForm({ ...emptyForm })
    setPreviewSrc("")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        size={isMobile ? "full" : "xl"}
        showCloseButton={false}
        className="flex h-full w-full flex-col p-0"
      >
        {/* Header — a real header, not a scrolling hero: eyebrow + close,
            photo + editable name at title size, a stat line under it, then
            a divider before the body (founder, 2026-09-15: "a full header
            with divider, body containing the fields, footer with saving
            action"). */}
        <SheetHeader className="shrink-0 gap-3 px-4 pt-4 pb-0 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {isEditMode ? "Edit teacher" : "Add teacher"}
            </span>
            <SheetClose asChild>
              <button
                className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <XIcon className="size-5" />
              </button>
            </SheetClose>
          </div>

          <div className="flex items-center gap-3.5">
            <div
              className="group/avatar relative flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-muted-foreground/50"
              onClick={() => !previewSrc && fileInputRef.current?.click()}
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Preview"
                  className="size-full object-cover"
                />
              ) : (
                <Avatar className="size-full rounded-2xl">
                  <AvatarFallback className="rounded-2xl text-base">
                    {form.fullName ? (
                      initials(form.fullName)
                    ) : (
                      <CameraIcon className="size-5 text-muted-foreground" />
                    )}
                  </AvatarFallback>
                </Avatar>
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
                    className="hover:text-destructive-foreground flex size-6 items-center justify-center rounded-full bg-background text-destructive shadow hover:bg-destructive"
                    aria-label="Remove photo"
                  >
                    <TrashIcon className="size-3" />
                  </button>
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <CircleNotchIcon className="size-4 animate-spin" />
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
            <div className="flex min-w-0 flex-1 flex-col">
              <input
                value={form.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                placeholder="Teacher's full name"
                className="-mx-1 -my-0.5 rounded-md px-1 py-0.5 text-xl font-semibold text-foreground outline-none hover:bg-muted focus:bg-muted"
              />
              <SheetTitle className="sr-only">
                {isEditMode ? "Edit teacher" : "Add teacher"}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  {describeGrades(form.teachableGrades, "No grades yet")}
                </span>
                <span>
                  {form.subjectIds.length > 0
                    ? `${form.subjectIds.length} ${form.subjectIds.length === 1 ? "subject" : "subjects"}`
                    : "No subjects yet"}
                </span>
                {derivedDepartmentName && <span>{derivedDepartmentName}</span>}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 sm:px-6">
          <CurlyDivider id="teacher-curly-header" />
        </div>

        {/* Body */}
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-4 pt-4 pb-5 sm:px-6">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">
                Work Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <EnvelopeIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
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
                <PhoneIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Enter Phone Number"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </div>
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
                      {form.dateOfJoining ? (
                        format(form.dateOfJoining, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
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

            {customSection("basic")}

            <CurlyDivider id="teacher-curly-professional" />

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Grade</Label>
              <p className="text-xs text-muted-foreground">
                Narrows which subjects can be picked below — pick this first.
              </p>
              <div className="flex flex-wrap gap-1">
                {GRADES.map((g) => {
                  const on = form.teachableGrades.includes(g)
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        updateField(
                          "teachableGrades",
                          (on
                            ? form.teachableGrades.filter((x) => x !== g)
                            : [...form.teachableGrades, g]
                          ).sort((a, b) => a - b)
                        )
                      }
                      className={cn(
                        "min-w-8 rounded-md border px-2 py-1 text-xs tabular-nums transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {gradeLabel(g)}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">
                Subjects they can teach{" "}
                <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Only subjects offered in the grade picked above show up here.
              </p>
              <div className="overflow-hidden rounded-lg border border-border">
                {form.subjectIds.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">
                    Pick at least one subject.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {form.subjectIds.map((sid) => {
                      const s = subjectById.get(sid)
                      const isPrimary = sid === form.primarySubjectId
                      return (
                        <li
                          key={sid}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-foreground">
                            {s?.subjectName ?? sid}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateField("primarySubjectId", sid)
                              }
                              disabled={isPrimary}
                              className={cn(
                                "flex items-center gap-1 text-xs",
                                isPrimary
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <StarIcon
                                weight={isPrimary ? "fill" : "regular"}
                                className="size-3.5"
                              />
                              {isPrimary ? "Primary" : "Set primary"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSubject(sid)}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              Remove
                            </button>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <Popover
                  open={subjectPickerOpen}
                  onOpenChange={(v) => {
                    setSubjectPickerOpen(v)
                    if (!v) setSubjectQuery("")
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <span className="flex items-center gap-1.5">
                        <PlusIcon className="size-3.5" />
                        Add a subject
                      </span>
                      <CaretRightIcon className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-0">
                    <div className="relative border-b border-border p-2">
                      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoFocus
                        value={subjectQuery}
                        onChange={(e) => setSubjectQuery(e.target.value)}
                        placeholder="Search subjects"
                        className="h-8 pl-8 text-sm"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {availableSubjects.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">
                          {subjects.length === form.subjectIds.length
                            ? "Every subject is already picked."
                            : "No match."}
                        </p>
                      ) : (
                        availableSubjects.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => addSubject(s.id)}
                            className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                          >
                            {s.subjectName}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Department</Label>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                {derivedDepartmentName ?? "Auto-fills once a subject is picked"}
              </div>
              <p className="text-xs text-muted-foreground">
                Set from the primary subject — change it later from that
                department's own page if a school assigns the department first
                and the subject after.
              </p>
            </div>

            {customSection("professional")}

            {defsForSection(customDefs, "additional").length > 0 && (
              <>
                <CurlyDivider id="teacher-curly-additional" />
                {/* Additional details — school-defined custom fields (/setup) */}
                <p className="text-xs font-medium text-muted-foreground">
                  Additional Details
                </p>
                {customSection("additional")}
              </>
            )}
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
            {isSaving && <CircleNotchIcon className="animate-spin" />}
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
