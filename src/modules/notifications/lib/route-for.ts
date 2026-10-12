export interface RailNotification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  created_at: string
  read_at: string | null
}

/** Where a notification leads. The stored link decides; rows from before
 *  tabs existed fall back to a route derived from their type. A null result
 *  means the notification IS its own detail (e.g. the morning digest) — the
 *  bell sends those to the Notifications page instead. */
// Leave & substitution lives on its own page now; rows that stored the old
// /attendance/leave links still work — the attendance page redirects them.
const TYPE_ROUTE: Record<string, string> = {
  leave_requested: "/leave",
  substitution_offer: "/leave/substitutions",
  substitution_auto: "/leave/substitutions",
}

export function routeFor(n: RailNotification): string | null {
  if (n.link && n.link !== "/attendance") return n.link
  return TYPE_ROUTE[n.type] ?? n.link
}
