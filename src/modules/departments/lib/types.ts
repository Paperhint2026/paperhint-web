export type Head = { id: string; full_name: string }
export type SubjectLite = { id: string; subject_name: string }
export type SubjectOption = SubjectLite & { grades: number[] }

export type Department = {
  id: string
  name: string
  heads: Head[]
  grades: number[]
  subjects: SubjectLite[]
  member_count: number
}

export type TeachableSubject = SubjectLite & { is_primary: boolean }

export type Teacher = {
  id: string
  full_name: string
  email?: string
  designation?: string | null
  department_id?: string | null
  /** What this teacher can teach. The primary subject is what puts them in a
   *  department; the rest are capability and do not move them. */
  teachable_subjects?: TeachableSubject[]
  teachable_grades?: number[]
}
