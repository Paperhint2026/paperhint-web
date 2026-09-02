import { useLocation, useParams } from "react-router-dom"

import { CopilotPanel } from "@/components/copilot/copilot-panel"

export function CopilotPage() {
  // Keying on location.key remounts the panel on every navigation — landing
  // and thread are separate pages, so no chat state survives moving between
  // them. Re-clicking "Ask Hint" while already here also lands a fresh chat.
  const location = useLocation()
  const { chatId } = useParams<{ chatId: string }>()
  const initialPrompt =
    (location.state as { prompt?: string } | null)?.prompt ?? null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <CopilotPanel
        key={location.key}
        initialChatId={chatId ?? null}
        initialPrompt={initialPrompt}
      />
    </div>
  )
}
