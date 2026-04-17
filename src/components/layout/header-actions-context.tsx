import { createContext, useContext, useState, type ReactNode } from "react"

interface HeaderActionsContextValue {
  headerActions: ReactNode
  setHeaderActions: (actions: ReactNode) => void
}

const HeaderActionsContext = createContext<HeaderActionsContextValue>({
  headerActions: null,
  setHeaderActions: () => {},
})

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [headerActions, setHeaderActions] = useState<ReactNode>(null)
  return (
    <HeaderActionsContext.Provider value={{ headerActions, setHeaderActions }}>
      {children}
    </HeaderActionsContext.Provider>
  )
}

export function useHeaderActions() {
  return useContext(HeaderActionsContext)
}
