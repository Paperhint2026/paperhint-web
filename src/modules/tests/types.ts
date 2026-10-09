/** Online tests (migration 058) — client mirror of the server shapes. */

export type QuestionType =
  | "mcq"
  | "true_false"
  | "fill_blank"
  | "match"
  | "short_answer"

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "MCQ",
  true_false: "True / False",
  fill_blank: "Fill in the blank",
  match: "Match the following",
  short_answer: "Short answer",
}

/** The gradable payload — mirrors questions.online_config exactly. */
export interface OnlineConfig {
  options?: string[]
  correct?: number[]
  answer?: boolean
  blanks?: string[][]
  left?: string[]
  right?: string[]
  key?: number[]
  rubric?: string
}

export interface TestQuestion {
  id: string
  question_text: string
  type: QuestionType
  marks: number
  question_order: number
  online_config: OnlineConfig
}

export interface TestSettings {
  shuffle_questions: boolean
  shuffle_options: boolean
  allow_back: boolean
  instant_results: boolean
  negative_marking: { enabled: boolean; fraction: number }
  tab_policy: { mode: "log" | "warn" | "auto_submit"; max: number }
  camera_policy: "off" | "optional" | "required"
  pin: "off" | "teacher" | "parent_whatsapp"
  grace_seconds: number
  /** 'ai' = Gemini grades written answers on submit (metered); 'manual' = free. */
  short_answer_grading: "ai" | "manual"
}

export interface OnlineTest {
  id: string
  class_subject_id: string
  /** The teacher who created the test — only they see the "Show answers" toggle. */
  teacher_id: string
  exam_name: string
  total_marks: number | null
  delivery: "online"
  duration_minutes: number | null
  opens_at: string | null
  closes_at: string | null
  published_at: string | null
  test_token: string | null
  test_settings: TestSettings
  created_at: string
  question_count?: number
}

export type TestStatus = "draft" | "scheduled" | "live" | "closed"

export function testStatus(t: OnlineTest, now = new Date()): TestStatus {
  if (!t.published_at) return "draft"
  if (t.opens_at && now < new Date(t.opens_at)) return "scheduled"
  if (t.closes_at && now > new Date(t.closes_at)) return "closed"
  return "live"
}

export function testLink(t: OnlineTest) {
  return t.test_token ? `${window.location.origin}/t/${t.test_token}` : null
}

/** How many ___ blanks the text declares — must mirror the server's rule. */
export function blankCount(text: string) {
  return (text.match(/_{3,}/g) || []).length
}
