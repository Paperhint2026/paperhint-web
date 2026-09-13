export type RolloverPlanClass = {
  source_class_id: string
  action: "promote" | "graduate"
  target?: {
    grade: number
    section: string
    academic_year: string
  }
}

export type RolloverException = {
  student_id: string
  source_class_id: string
  kind: "detain_move" | "detain_promote" | "move_section" | "withdraw"
  target_grade?: number
  target_section?: string
  target_class_id?: string
}

export type RolloverPlan = {
  id: string
  school_id: string
  from_year: string
  to_year: string
  status: "draft" | "executed" | "abandoned"
  plan: {
    classes: RolloverPlanClass[]
    students: RolloverException[]
  }
  result?: Record<string, unknown> | null
}

export type ContextClass = {
  id: string
  grade: number
  section: string
  academic_year: string
  student_count: number
  detained_count: number
  is_pending_promotion: boolean
}

export type RosterRow = {
  student_id: string
  full_name: string
  roll_number: number | string | null
  admission_number: string | null
  detained: boolean
  exception: RolloverException | null
}
