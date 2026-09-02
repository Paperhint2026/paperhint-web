import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

import { useHelpDialog } from "@/components/help/help-dialog-context"

/**
 * `/help` is a deep link, not a page: it opens the Help & support dialog over
 * Home and steps out of the way, so a bookmarked or shared link still lands
 * somewhere useful once the dialog is closed.
 */
export function HelpPage() {
  const { open } = useHelpDialog()
  const navigate = useNavigate()

  useEffect(() => {
    open()
    navigate("/", { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
