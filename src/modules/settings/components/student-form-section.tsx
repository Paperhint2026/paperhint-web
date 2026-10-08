import { SectionMotion } from "@/modules/settings/components/settings-primitives"
import { FormBuilder } from "@/modules/setup/components/form-builder"

/**
 * Solo/coaching owners shape their own Add-Student form here. Schools do the
 * same from /setup; this is the same builder, reachable from Settings
 * because owners have no admin console.
 */
export function StudentFormSection() {
  return (
    <SectionMotion>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Student form</h2>
          <p className="text-sm text-muted-foreground">
            Name and batch are always asked. Add the fields you actually collect
            — a parent's WhatsApp number, school name, fee plan — and they
            appear on Add Student, on each student's page, and in the import.
          </p>
        </div>
        <FormBuilder entity="student" />
      </div>
    </SectionMotion>
  )
}
