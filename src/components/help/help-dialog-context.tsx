/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type HelpTab = "answers" | "contact" | "shortcuts"

type HelpDialogState = {
  isOpen: boolean
  tab: HelpTab
  open: (tab?: HelpTab) => void
  close: () => void
  setTab: (tab: HelpTab) => void
}

const HelpDialogContext = createContext<HelpDialogState | null>(null)

/**
 * Help & support is a modal over whatever page is open, not a page of its
 * own — you shouldn't lose your place to ask a question. This holds its open
 * state so the user menu, the `?` shortcut and the `/help` deep link all
 * reach the same dialog.
 */
export function HelpDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<HelpTab>("answers")

  const value = useMemo<HelpDialogState>(
    () => ({
      isOpen,
      tab,
      open: (next) => {
        if (next) setTab(next)
        setIsOpen(true)
      },
      close: () => setIsOpen(false),
      setTab,
    }),
    [isOpen, tab]
  )

  return (
    <HelpDialogContext.Provider value={value}>
      {children}
    </HelpDialogContext.Provider>
  )
}

export function useHelpDialog() {
  const ctx = useContext(HelpDialogContext)
  if (!ctx) {
    throw new Error("useHelpDialog must be used within a HelpDialogProvider")
  }
  return ctx
}

export type { HelpTab }
