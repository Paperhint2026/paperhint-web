import { apiClient } from "@/lib/api-client"

export type AudienceType =
  | "all_teachers"
  | "class_teachers"
  | "grades"
  | "class_teachers_grades"
  | "teachers"
  | "parents"

export type CircularKind = "circular" | "activity" | "report" | "announcement"

export interface Audience {
  type: AudienceType
  grades: number[]
  teacher_ids: string[]
  /** Parents lane — rides along with any type, or stands alone as type
   *  "parents". class_ids empty = all the sender is allowed to reach. */
  parents?: { enabled: boolean; class_ids: string[] }
}

export interface Attachment {
  name: string
  path: string
  size: number
  mime: string
  is_image: boolean
  /** Server-sniffed content kind — drives the preview dialog. */
  kind?: "image" | "pdf" | "text" | "office"
  /** True for images placed inside the body (never listed as chips). */
  inline?: boolean
  cid?: string
  /** Signed inline URL, present only on the detail endpoint (1h TTL). */
  url?: string | null
  /** Signed URL forcing Content-Disposition: attachment. */
  download_url?: string | null
}

export interface CircularSummary {
  id: string
  subject: string
  kind?: CircularKind
  relay_to_parents?: boolean
  public_token?: string | null
  i_sent_this?: boolean
  excerpt: string
  audience: Audience
  audience_label: string
  attachment_count: number
  author_name: string | null
  sent_at: string
  // admin
  recipients_total?: number
  read_count?: number
  acknowledged_count?: number
  // teacher
  my_read_at?: string | null
  my_acknowledged_at?: string | null
}

export interface CircularDetail {
  id: string
  subject: string
  body_md: string
  kind?: CircularKind
  relay_to_parents?: boolean
  public_token?: string | null
  parent_recipients_total?: number
  audience: Audience
  audience_label: string
  attachments: Attachment[]
  author_name: string | null
  sent_at: string
  recipients_total?: number
  read_count?: number
  acknowledged_count?: number
  my_read_at?: string | null
  my_acknowledged_at?: string | null
}

export interface Recipient {
  teacher_id: string
  teacher_name: string
  profile_url: string | null
  delivered_at: string
  read_at: string | null
  acknowledged_at: string | null
}

export interface AudienceOptions {
  grades: number[]
  teachers: { id: string; full_name: string }[]
  teacher_count: number
  class_teacher_count: number
}

export interface AudiencePreview {
  label: string
  count: number
  teachers: { id: string; full_name: string }[]
  parent_count?: number
  parent_languages?: string[]
}

export const circularsApi = {
  list: () => apiClient.get<{ circulars: CircularSummary[] }>("/api/circulars"),
  get: (id: string) => apiClient.get<{ circular: CircularDetail }>(`/api/circulars/${id}`),
  recipients: (id: string) =>
    apiClient.get<{ recipients: Recipient[] }>(`/api/circulars/${id}/recipients`),
  acknowledge: (id: string) =>
    apiClient.post<{ acknowledged_at: string }>(`/api/circulars/${id}/acknowledge`),
  options: () => apiClient.get<AudienceOptions>("/api/circulars/audience/options"),
  preview: (audience: Audience) =>
    apiClient.get<AudiencePreview>(
      `/api/circulars/audience/preview?audience=${encodeURIComponent(JSON.stringify(audience))}`
    ),
  create: (form: FormData) =>
    apiClient.post<{ circular: CircularDetail }>("/api/circulars", form),
  forwardToParents: (id: string) =>
    apiClient.post<{ parents_added: number; parents_total: number; public_token: string }>(
      `/api/circulars/${id}/forward-to-parents`
    ),
}

export const KIND_LABEL: Record<CircularKind, string> = {
  circular: "Circular",
  activity: "Class activity",
  report: "Report",
  announcement: "Announcement",
}

export const PARENT_LANGUAGE_LABEL: Record<string, string> = {
  hi: "Hindi", ta: "Tamil", te: "Telugu", kn: "Kannada", ml: "Malayalam",
  mr: "Marathi", bn: "Bengali", gu: "Gujarati", pa: "Punjabi", or: "Odia",
  as: "Assamese", ur: "Urdu", en: "English",
}

/** The wa.me share text for a sent circular with a public link. */
export function whatsappShareUrl(subject: string, token: string) {
  const link = `${window.location.origin}/c/${token}`
  const text = `*${subject}*

${link}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export const AUDIENCE_TYPE_LABEL: Record<AudienceType, string> = {
  all_teachers: "All teachers",
  class_teachers: "All class teachers",
  grades: "Teachers of selected grades",
  class_teachers_grades: "Class teachers of selected grades",
  teachers: "Specific teachers",
  parents: "Parents",
}
