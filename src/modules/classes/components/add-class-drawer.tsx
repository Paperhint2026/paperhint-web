import { useState } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  CaretDownIcon,
  CircleNotchIcon,
  PlusIcon,
  GearIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import {
  getCurrentAcademicYear,
  validateAcademicYear,
} from "@/lib/academic-year"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  ElectiveConfigModal,
  type ElectiveGroup,
} from "./elective-config-modal"

export interface SectionEntry {
  name: string
  subjects: string[]
  electives: ElectiveGroup[]
}

export interface ClassFormData {
  grade: number | ""
  sections: SectionEntry[]
  academicYear: string
}

export interface AddClassDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: ClassFormData) => void
  availableSubjects: { value: string; label: string }[]
  existingGrades?: number[]
  isSaving?: boolean
}

const emptyForm: ClassFormData = {
  grade: "",
  sections: [{ name: "A", subjects: [], electives: [] }],
  academicYear: getCurrentAcademicYear(),
}

export function AddClassDrawer({
  open,
  onOpenChange,
  onSave,
  availableSubjects,
  existingGrades = [],
  isSaving = false,
}: AddClassDrawerProps) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState<ClassFormData>({ ...emptyForm })
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set([0])
  )
  const [electiveModalSection, setElectiveModalSection] = useState<
    number | null
  >(null)

  const toggleAccordion = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleGradeChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num >= 1 && num <= 12) {
      setForm((prev) => ({ ...prev, grade: num }))
    } else if (value === "") {
      setForm((prev) => ({ ...prev, grade: "" }))
    }
  }

  const addSection = () => {
    setForm((prev) => {
      const lastName = prev.sections[prev.sections.length - 1]?.name
      const nextChar = String.fromCharCode((lastName?.charCodeAt(0) ?? 64) + 1)
      return {
        ...prev,
        sections: [
          ...prev.sections,
          { name: nextChar, subjects: [], electives: [] },
        ],
      }
    })
    setExpandedSections((prev) => {
      const next = new Set(prev)
      next.add(form.sections.length)
      return next
    })
  }

  const updateSectionName = (index: number, value: string) => {
    setForm((prev) => {
      const updated = [...prev.sections]
      updated[index] = { ...updated[index], name: value.toUpperCase() }
      return { ...prev, sections: updated }
    })
  }

  const removeSection = (index: number) => {
    if (form.sections.length <= 1) return
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }))
    setExpandedSections((prev) => {
      const next = new Set<number>()
      for (const idx of prev) {
        if (idx < index) next.add(idx)
        else if (idx > index) next.add(idx - 1)
      }
      return next
    })
  }

  const toggleSectionSubject = (sectionIndex: number, subjectValue: string) => {
    setForm((prev) => {
      const updated = [...prev.sections]
      const section = updated[sectionIndex]
      const exists = section.subjects.includes(subjectValue)

      let updatedElectives = section.electives
      if (!exists) {
        updatedElectives = section.electives.map((g) => ({
          ...g,
          subjectIds: g.subjectIds.filter((id) => id !== subjectValue),
        }))
      }

      updated[sectionIndex] = {
        ...section,
        subjects: exists
          ? section.subjects.filter((s) => s !== subjectValue)
          : [...section.subjects, subjectValue],
        electives: updatedElectives,
      }
      return { ...prev, sections: updated }
    })
  }

  const getElectiveSubjectIds = (sectionIndex: number): Set<string> => {
    const section = form.sections[sectionIndex]
    return new Set(section.electives.flatMap((g) => g.subjectIds))
  }

  const handleSaveElectives = (
    sectionIndex: number,
    groups: ElectiveGroup[]
  ) => {
    setForm((prev) => {
      const updated = [...prev.sections]
      updated[sectionIndex] = { ...updated[sectionIndex], electives: groups }
      return { ...prev, sections: updated }
    })
  }

  const totalElectives = (sectionIndex: number) => {
    const section = form.sections[sectionIndex]
    return section.electives.length
  }

  const isFormValid =
    form.grade !== "" &&
    form.sections.length > 0 &&
    form.sections.every(
      (s) =>
        s.name.trim() !== "" &&
        (s.subjects.length > 0 || s.electives.length > 0)
    ) &&
    validateAcademicYear(form.academicYear) === null &&
    form.sections.every((s) =>
      s.electives.every(
        (g) => g.groupName.trim() !== "" && g.subjectIds.length >= 2
      )
    )

  const handleSave = () => {
    onSave(form)
    setForm({ ...emptyForm })
    setExpandedSections(new Set([0]))
  }

  const handleClose = () => {
    onOpenChange(false)
    setForm({ ...emptyForm })
    setExpandedSections(new Set([0]))
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          size={isMobile ? "full" : "xl"}
          showCloseButton={false}
          className="flex h-full w-full flex-col p-0"
        >
          {/* Header */}
          <SheetHeader className="border-b bg-muted/50 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-base font-medium text-secondary-foreground">
                  Add Class Room
                </SheetTitle>
                <SheetDescription>
                  Set up a new class with grade, sections, and subjects.
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
              {/* Grade */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Grade</Label>
                <Select
                  value={form.grade === "" ? undefined : String(form.grade)}
                  onValueChange={handleGradeChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select grade (1–12)" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1)
                      .filter((g) => !existingGrades.includes(g))
                      .map((g) => (
                        <SelectItem key={g} value={String(g)}>
                          Grade {g}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Sections with per-section subjects */}
              <div className="flex flex-col gap-3">
                <Label className="text-sm">Sections & Subjects</Label>

                <div className="flex flex-col gap-2">
                  {form.sections.map((section, index) => {
                    const isExpanded = expandedSections.has(index)
                    const electiveCount = totalElectives(index)
                    const electiveSubjectIds = getElectiveSubjectIds(index)
                    return (
                      <div
                        key={index}
                        className="overflow-hidden rounded-lg border"
                      >
                        {/* Accordion header */}
                        <div className="flex items-center gap-2 bg-muted/30 px-3 py-2">
                          <button
                            type="button"
                            className="shrink-0"
                            onClick={() => toggleAccordion(index)}
                          >
                            <CaretDownIcon
                              className={cn(
                                "size-4 text-muted-foreground transition-transform",
                                !isExpanded && "-rotate-90"
                              )}
                            />
                          </button>
                          <span className="text-sm font-medium">Section</span>
                          <input
                            className="w-10 border-b border-transparent bg-transparent text-center text-sm font-medium outline-none focus:border-primary"
                            value={section.name}
                            maxLength={2}
                            placeholder="—"
                            onChange={(e) =>
                              updateSectionName(index, e.target.value)
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            ({section.subjects.length} core
                            {electiveCount > 0 && `, ${electiveCount} elective`}
                            )
                          </span>
                          <div className="flex-1" />
                          {form.sections.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => removeSection(index)}
                            >
                              <TrashIcon className="size-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>

                        {/* Accordion body */}
                        {isExpanded && (
                          <div className="flex flex-col gap-3 px-3 py-3">
                            {/* Core subjects */}
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs">Core Subjects</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {availableSubjects.map((subject) => {
                                  const selected = section.subjects.includes(
                                    subject.value
                                  )
                                  const usedInElective = electiveSubjectIds.has(
                                    subject.value
                                  )
                                  return (
                                    <button
                                      key={subject.value}
                                      type="button"
                                      disabled={usedInElective}
                                      onClick={() =>
                                        toggleSectionSubject(
                                          index,
                                          subject.value
                                        )
                                      }
                                      className={
                                        usedInElective
                                          ? "inline-flex items-center rounded-md border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground/40 line-through"
                                          : selected
                                            ? "inline-flex items-center rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors"
                                            : "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                                      }
                                    >
                                      {subject.label}
                                    </button>
                                  )
                                })}
                              </div>
                              {section.subjects.length === 0 &&
                                electiveCount === 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Select at least one subject or add an
                                    elective group
                                  </p>
                                )}
                            </div>

                            <Separator />

                            {/* Electives summary + configure button */}
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">
                                  Elective Groups
                                </Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => setElectiveModalSection(index)}
                                >
                                  <GearIcon className="size-3" />
                                  {electiveCount > 0
                                    ? `Configure (${electiveCount})`
                                    : "Add Electives"}
                                </Button>
                              </div>

                              {electiveCount > 0 && (
                                <div className="flex flex-col gap-1.5">
                                  {section.electives.map((group, gi) => (
                                    <div
                                      key={gi}
                                      className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2"
                                    >
                                      <div className="flex flex-1 flex-col gap-1">
                                        <span className="text-xs font-medium">
                                          {group.groupName}
                                        </span>
                                        <div className="flex flex-wrap gap-1">
                                          {group.subjectIds.map((sid) => {
                                            const subj = availableSubjects.find(
                                              (s) => s.value === sid
                                            )
                                            return (
                                              <span
                                                key={sid}
                                                className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                              >
                                                {subj?.label ?? sid}
                                              </span>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div>
                  <Button variant="secondary" size="sm" onClick={addSection}>
                    <PlusIcon className="size-4" />
                    Add Section
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Academic Year */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Academic Year</Label>
                <Input
                  placeholder="e.g. 2026-2027"
                  value={form.academicYear}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      academicYear: e.target.value,
                    }))
                  }
                />
                {form.academicYear.trim() !== "" &&
                validateAcademicYear(form.academicYear) ? (
                  <p className="text-xs text-destructive">
                    {validateAcademicYear(form.academicYear)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pre-filled with the current school year. Edit if needed.
                  </p>
                )}
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
              {isSaving ? "Creating..." : "Add Class Room"}
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

      {electiveModalSection !== null && (
        <ElectiveConfigModal
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setElectiveModalSection(null)
          }}
          sectionName={form.sections[electiveModalSection].name}
          availableSubjects={availableSubjects}
          coreSubjectIds={form.sections[electiveModalSection].subjects}
          initialGroups={form.sections[electiveModalSection].electives}
          onSave={(groups) => handleSaveElectives(electiveModalSection, groups)}
        />
      )}
    </>
  )
}
