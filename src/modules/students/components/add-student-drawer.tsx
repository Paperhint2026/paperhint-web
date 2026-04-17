import { useEffect, useMemo, useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { format } from "date-fns"
import { CalendarIcon, Loader2Icon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ClassItem } from "@/modules/students/components/student-class-card"

export interface StudentEntry {
  full_name: string
  date_of_birth: string
  gender: string
  blood_group: string
  admission_number: string
  academic_year: string
  grade: string
  section: string
  roll_number: number | ""
  register_number: string
  street: string
  city: string
  contact_number: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
}

interface AddStudentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (student: StudentEntry) => void
  classes: ClassItem[]
  isSaving?: boolean
  mode?: "create" | "edit"
  initialData?: StudentEntry | null
}

const emptyEntry: StudentEntry = {
  full_name: "",
  date_of_birth: "",
  gender: "",
  blood_group: "",
  admission_number: "",
  academic_year: "",
  grade: "",
  section: "",
  roll_number: "",
  register_number: "",
  street: "",
  city: "",
  contact_number: "",
  emergency_contact_name: "",
  emergency_contact_relationship: "",
  emergency_contact_phone: "",
}

const GENDER_OPTIONS = ["Male", "Female", "Other"]
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

export function AddStudentDrawer({
  open,
  onOpenChange,
  onSave,
  classes,
  isSaving = false,
  mode = "create",
  initialData = null,
}: AddStudentDrawerProps) {
  const isMobile = useIsMobile()
  const [entry, setEntry] = useState<StudentEntry>({ ...emptyEntry })

  useEffect(() => {
    if (open) {
      setEntry(initialData ? { ...initialData } : { ...emptyEntry })
    }
  }, [open, initialData])

  const isEdit = mode === "edit"

  const update = (field: keyof StudentEntry, value: string | number | "") => {
    setEntry((prev) => ({ ...prev, [field]: value }))
  }

  // Unique sorted grades from classes
  const gradeOptions = useMemo(
    () => [...new Set(classes.map((c) => String(c.grade)))].sort((a, b) => Number(a) - Number(b)),
    [classes],
  )

  // Sections for the selected grade (or all if no grade picked)
  const sectionOptions = useMemo(() => {
    const pool = entry.grade
      ? classes.filter((c) => String(c.grade) === entry.grade)
      : classes
    return [...new Set(pool.map((c) => c.section))].sort()
  }, [classes, entry.grade])

  const handleGradeChange = (val: string) => {
    update("grade", val)
    update("section", "") // reset section when grade changes
  }

  const isFormValid =
    entry.full_name.trim() !== "" &&
    entry.date_of_birth !== "" &&
    entry.gender !== ""

  const handleSave = () => {
    if (!isFormValid) return
    onSave(entry)
  }

  const handleClose = () => {
    onOpenChange(false)
    setEntry({ ...emptyEntry })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} size={isMobile ? "full" : "xl"} showCloseButton={false} className="flex h-full w-full flex-col p-0">
        {/* Header */}
        <SheetHeader className="border-b bg-muted/50 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base font-medium text-secondary-foreground">
                {isEdit ? "Edit Student" : "Add Student"}
              </SheetTitle>
              <SheetDescription>
                {isEdit
                  ? "Update the student's details."
                  : "Fill in the student's details to enroll them."}
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
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">

            {/* Personal Information */}
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Personal Information</p>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Full Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. John Doe"
                value={entry.full_name}
                onChange={(e) => update("full_name", e.target.value)}
              />
            </div>

            {/* Date of Birth + Gender — 2 col */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Date of Birth <span className="text-destructive">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      data-empty={!entry.date_of_birth}
                      className="w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground"
                    >
                      <CalendarIcon className="size-4" />
                      {entry.date_of_birth
                        ? format(new Date(entry.date_of_birth + "T00:00:00"), "PPP")
                        : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={entry.date_of_birth ? new Date(entry.date_of_birth + "T00:00:00") : undefined}
                      onSelect={(d) => update("date_of_birth", d ? format(d, "yyyy-MM-dd") : "")}
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Gender <span className="text-destructive">*</span></Label>
                <Select value={entry.gender} onValueChange={(v) => update("gender", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Blood Group</Label>
              <Select value={entry.blood_group} onValueChange={(v) => update("blood_group", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Academic Details */}
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Academic Details</p>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Admission Number</Label>
              <Input
                placeholder="e.g. ADM2024001"
                value={entry.admission_number}
                onChange={(e) => update("admission_number", e.target.value)}
              />
            </div>

            {/* Grade + Section — 2 col */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Grade</Label>
                <Select value={entry.grade} onValueChange={handleGradeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map((g) => (
                      <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Section</Label>
                <Select value={entry.section} onValueChange={(v) => update("section", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionOptions.map((s) => (
                      <SelectItem key={s} value={s}>Section {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Academic Year</Label>
              <Input
                placeholder="e.g. 2024–2025"
                value={entry.academic_year}
                onChange={(e) => update("academic_year", e.target.value)}
              />
            </div>

            {/* Roll Number + Register Number — 2 col */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Roll Number</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 1"
                  value={entry.roll_number}
                  onChange={(e) => {
                    const val = e.target.value
                    update("roll_number", val === "" ? "" : parseInt(val, 10))
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Register Number</Label>
                <Input
                  placeholder="e.g. REG2024001"
                  value={entry.register_number}
                  onChange={(e) => update("register_number", e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Address */}
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</p>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Street / House No.</Label>
              <Input
                placeholder="e.g. 42 Maple Street"
                value={entry.street}
                onChange={(e) => update("street", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">City</Label>
              <Input
                placeholder="e.g. New York"
                value={entry.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Contact Number</Label>
              <Input
                type="tel"
                placeholder="e.g. +1 555 0100"
                value={entry.contact_number}
                onChange={(e) => update("contact_number", e.target.value)}
              />
            </div>

            <Separator />

            {/* Emergency Contact */}
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Emergency Contact</p>

            {/* Contact Name + Relationship — 2 col */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Contact Name</Label>
                <Input
                  placeholder="e.g. Jane Doe"
                  value={entry.emergency_contact_name}
                  onChange={(e) => update("emergency_contact_name", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Relationship</Label>
                <Input
                  placeholder="e.g. Parent"
                  value={entry.emergency_contact_relationship}
                  onChange={(e) => update("emergency_contact_relationship", e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">Phone Number</Label>
              <Input
                type="tel"
                placeholder="e.g. +1 555 0199"
                value={entry.emergency_contact_phone}
                onChange={(e) => update("emergency_contact_phone", e.target.value)}
              />
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
            {isSaving ? "Saving..." : isEdit ? "Update Student" : "Save Student"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleClose}
          >
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
