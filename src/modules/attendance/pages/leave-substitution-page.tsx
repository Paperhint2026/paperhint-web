import { useEffect, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router-dom"
import { UserSwitchIcon } from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

import { AdminLeaveList, AdminSubstitutions } from "./attendance-page"

/**
 * Leave & substitution (A10), split out of the Attendance page so each nav
 * row owns one job: Attendance = the rolls, this page = who is away and who
 * covers. Tabs live in the URL (/leave, /leave/substitutions) so notification
 * links land on the right view.
 */

const TABS = ["leave", "substitutions"] as const
type Tab = (typeof TABS)[number]

export function LeaveSubstitutionPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tab: tabParam } = useParams<{ tab: string }>()
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "leave"
  const [pending, setPending] = useState(0)

  useEffect(() => {
    apiClient
      .get<{ pending: number }>("/api/leaves")
      .then((r) => setPending(r.pending ?? 0))
      .catch(() => {})
  }, [tab])

  // Teachers apply for leave and pick up covers from their Attendance page;
  // this admin surface would just confuse them.
  if (user && user.role !== "admin") return <Navigate to="/attendance" replace />

  return (
    <div className={cn("flex flex-col gap-5 pb-12", PAGE_GUTTER, PAGE_TOP)}>
      <PageHeader
        icon={UserSwitchIcon}
        title="Leave & substitution"
        description="Approve leave, watch every alteration, and cover the gaps — free teachers are suggested for any period no colleague filled."
      />

      <div className="flex flex-col gap-4">
        <div className="flex gap-1 self-start rounded-lg bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => navigate(t === "leave" ? "/leave" : `/leave/${t}`)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
              {t === "leave" && pending > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </div>
        {tab === "leave" ? <AdminLeaveList onPendingChange={setPending} /> : <AdminSubstitutions />}
      </div>
    </div>
  )
}
