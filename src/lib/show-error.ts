import { toast } from "sonner"

/**
 * Every error the user sees carries a Copy button. When something breaks, the
 * exact text has to reach whoever will fix it — retyping a message off a
 * screenshot loses the part that matters (founder, 2026-09-13).
 */
export function showError(err: unknown, fallback = "That did not work") {
  const message = err instanceof Error ? err.message : String(err || fallback)
  toast.error(message, {
    duration: 12000,
    action: {
      label: "Copy",
      onClick: () => {
        navigator.clipboard?.writeText(message).then(
          () => toast.success("Error copied"),
          () => {
            /* clipboard blocked; the message is still on screen to read */
          }
        )
      },
    },
  })
  return message
}
