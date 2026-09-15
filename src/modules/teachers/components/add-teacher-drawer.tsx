import { useEffect, useMemo, useRef, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  CalendarIcon,
  CameraIcon,
  CaretRightIcon,
  CircleNotchIcon,
  LinkIcon,
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

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  /** What this teacher can teach — mandatory, independent of the live
   * class_subjects rows below. The department is derived server-side from
   * whichever of these is primary. */
  subjectIds: string[]
  primarySubjectId: string
  /** Grades this teacher can teach — a capability, not a timetable slot;
   * sections come later, from Classes & Subjects or the timetable itself. */
  teachableGrades: number[]
  classSubjects: ClassSubjectEntry[]
  existingAssignments: ExistingAssignment[]
  pendingProfileFile?: File
  customFields?: CustomFieldValues
}

export interface AddTeacherDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: TeacherFormData) => void
  onDisassociate?: (teacherId: string, classSubjectId: string) => Promise<void>
  teacherId?: string | null
  subjects: TeachableSubjectOption[]
  departmentNameById: Record<string, string>
  classes: { id: string; grade: number; section: string }[]
  fetchSubjectsForClass: (classId: string) => Promise<ClassSubjectOption[]>
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
  classSubjects: [{ classId: "", classSubjectId: "" }],
  existingAssignments: [],
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
  onDisassociate,
  teacherId,
  subjects,
  departmentNameById,
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
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false)
  const [subjectQuery, setSubjectQuery] = useState("")

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
          (a) => a.classSubjectId !== confirmDisassociate.classSubjectId
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
    value: TeacherFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  )

  // Assignment picks a specific class-subject for the timetable — the
  // capability picked above should narrow it, not sit beside it as an
  // unrelated list (founder, 2026-09-15: "we need the module linkage
  // seamless"). No grades picked yet means nothing to narrow by, so show
  // everything rather than an empty dropdown.
  const classOptions = classes
    .filter(
      (c) =>
        form.teachableGrades.length === 0 ||
        form.teachableGrades.includes(c.grade)
    )
    .sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section))
    .map((c) => ({
      value: c.id,
      label: `Grade ${c.grade} – ${c.section}`,
    }))

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
    setConfirmDisassociate(null)
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
        <div
          ref={bodyScrollRef}
          className="no-scrollbar flex-1 overflow-y-auto"
        >
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
              <div className="flex items-center justify-between">
                <Label className="text-sm">
                  Subjects they can teach{" "}
                  <span className="text-destructive">*</span>
                </Label>
                {derivedDepartmentName && (
                  <span className="text-xs text-muted-foreground">
                    Maps to {derivedDepartmentName}
                  </span>
                )}
              </div>
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

            <CurlyDivider id="teacher-curly-assignments" />

            {/* Classes & Subjects */}
            <p className="text-xs font-medium text-muted-foreground">
              Classes & Subjects
            </p>
            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? "Manage class-subject assignments for this teacher."
                : "Optional — skip this for common-period staff (PT, Art, Music, Library…); they're picked directly in the timetable's custom classes."}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="ml-1 flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setConfirmDisassociate(a)}
                            aria-label="Disassociate"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Disassociate</TooltipContent>
                      </Tooltip>
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
                      <CircleNotchIcon className="size-3 animate-spin" />
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
                // Only what this teacher is actually qualified for — the
                // class already narrowed to their grades above.
                const availableSubjects = (
                  entry.classId ? (subjectsByClass[entry.classId] ?? []) : []
                ).filter(
                  (sub) =>
                    form.subjectIds.length === 0 ||
                    form.subjectIds.includes(sub.subjectId)
                )
                const isLoadingSubs = entry.classId
                  ? (loadingSubjects[entry.classId] ?? false)
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
                          {classOptions.map((c) => (
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
                          disabled={
                            !entry.classId || availableSubjects.length === 0
                          }
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
                      <TrashIcon className="size-4" />
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
