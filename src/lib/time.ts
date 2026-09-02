import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)

/** "4mo ago", "2d ago", "just now" — the compact form lists use. */
export function timeAgo(date: string | number | Date) {
  const d = dayjs(date)
  const now = dayjs()
  const mins = now.diff(d, "minute")
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = now.diff(d, "hour")
  if (hours < 24) return `${hours}h ago`
  const days = now.diff(d, "day")
  if (days < 30) return `${days}d ago`
  const months = now.diff(d, "month")
  if (months < 12) return `${months}mo ago`
  const years = now.diff(d, "year")
  return `${years}y ago`
}
