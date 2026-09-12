import { cn } from "@/lib/utils"
import { useViewRole, type ViewRole } from "@/lib/view-role"

const OPTIONS: { value: ViewRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
]

/**
 * "View as" switcher, shown to admins only. Swaps the menu and Home to the
 * teacher shell for preview; nothing about permissions or data changes.
 * Hidden when the sidebar is collapsed to icons — there is no room for it.
 */
export function NavViewRole() {
  const { role, actualRole, canPreview, setPreview } = useViewRole()
  if (!canPreview) return null

  return (
    <div className="px-2 pb-1 group-data-[collapsible=icon]:hidden">
      <div className="mb-1 px-1 text-[10px] font-medium tracking-wide text-sidebar-label uppercase">
        View as
      </div>
      <div
        role="radiogroup"
        aria-label="View the app as"
        className="grid grid-cols-2 gap-0.5 rounded-lg bg-sidebar-accent/60 p-0.5"
      >
        {OPTIONS.map((o) => {
          const selected = role === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreview(o.value === actualRole ? null : o.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs transition-colors",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-sidebar-label hover:text-sidebar-foreground"
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
