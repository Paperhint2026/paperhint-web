export type Head = { id: string; full_name: string }
export type SubjectLite = { id: string; subject_name: string }

export type Department = {
  id: string
  name: string
  heads: Head[]
  grades: number[]
  subjects: SubjectLite[]
  member_count: number
}

export type Teacher = {
  id: string
  full_name: string
  email?: string
  designation?: string | null
  department_id?: string | null
}
