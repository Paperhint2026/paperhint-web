import { useCallback, useEffect, useRef, useState } from "react"

import { apiClient } from "@/lib/api-client"

export interface Material {
  id: string
  title: string
  file_url: string
  processed?: boolean
}

export interface ChatSource {
  id: string
  title: string
  tags?: string[]
  similarity?: number
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: ChatSource[]
  pinnedMaterialIds?: string[]
  isError?: boolean
  createdAt: number
}

export interface ClassAiChat {
  classSubjectId: string | null
  messages: ChatMessage[]
  input: string
  setInput: (value: string) => void
  pinnedIds: Set<string>
  togglePin: (id: string) => void
  clearPinned: () => void
  materials: Material[]
  isStreaming: boolean
  streamingMessageId: string | null
  send: (query: string, pinnedSnapshot: string[]) => Promise<void>
  resetChat: () => void
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

/**
 * Class-scoped AI chat state. Lifted out of the sheet so that closing the
 * sheet does NOT destroy the conversation — only switching to a different
 * class-subject, leaving the /class/:csId/* scope, or refreshing does.
 *
 * Because state lives here, in-flight streams also survive sheet close: the
 * fetch + abort controller live in this hook, not in the sheet.
 */
export function useClassAiChat(classSubjectId: string | null): ClassAiChat {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [materials, setMaterials] = useState<Material[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null,
  )

  const abortRef = useRef<AbortController | null>(null)

  // Reset on class-subject change (including → null when leaving /class/:csId/*).
  // Also fetches that class-subject's materials so @-mentions / attach work.
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setInput("")
    setPinnedIds(new Set())
    setIsStreaming(false)
    setStreamingMessageId(null)
    setMaterials([])

    if (!classSubjectId) return

    let active = true
    apiClient
      .get<{ materials: Material[] }>(
        `/api/knowledge/materials/${classSubjectId}`,
      )
      .then((res) => {
        if (active) setMaterials(res.materials ?? [])
      })
      .catch(() => {
        if (active) setMaterials([])
      })
    return () => {
      active = false
    }
  }, [classSubjectId])

  // Abort on unmount (covers logout / route leaves the protected tree).
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearPinned = useCallback(() => {
    setPinnedIds(new Set())
  }, [])

  const resetChat = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setIsStreaming(false)
    setStreamingMessageId(null)
    setPinnedIds(new Set())
    setInput("")
  }, [])

  const send = useCallback(
    async (query: string, pinnedSnapshot: string[]) => {
      const trimmed = query.trim()
      if (!trimmed || !classSubjectId || isStreaming) return

      const userMsgId = `u-${Date.now()}`
      const assistantMsgId = `a-${Date.now()}`

      // Snapshot the conversation BEFORE adding the new user turn so the
      // history sent to the server doesn't echo the just-typed query.
      const historyForRequest = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => !m.isError)
        .map((m) => ({ role: m.role, content: m.content }))

      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: "user",
          content: trimmed,
          pinnedMaterialIds: pinnedSnapshot,
          createdAt: Date.now(),
        },
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          sources: [],
          createdAt: Date.now(),
        },
      ])
      setStreamingMessageId(assistantMsgId)
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const token = localStorage.getItem("access_token")
        const response = await fetch(`${BASE_URL}/api/knowledge/ask-stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            query: trimmed,
            class_subject_id: classSubjectId,
            material_ids: pinnedSnapshot,
            conversation_history: historyForRequest,
          }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          let errText = `Request failed: ${response.status}`
          try {
            const j = await response.json()
            errText = j.error || j.message || errText
          } catch {
            // body was not JSON; keep generic message
          }
          throw new Error(errText)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE frames are separated by a blank line ("\n\n"). Drain whole
          // frames out of the buffer; leftover (partial frame) stays for the
          // next read.
          let sepIdx = buffer.indexOf("\n\n")
          while (sepIdx !== -1) {
            const rawFrame = buffer.slice(0, sepIdx)
            buffer = buffer.slice(sepIdx + 2)

            let eventName = "message"
            let dataLine = ""
            for (const line of rawFrame.split("\n")) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim()
              else if (line.startsWith("data:")) dataLine += line.slice(5).trim()
            }

            if (dataLine) {
              try {
                const payload = JSON.parse(dataLine)
                if (eventName === "token" && typeof payload.t === "string") {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: m.content + payload.t }
                        : m,
                    ),
                  )
                } else if (eventName === "sources" && Array.isArray(payload.sources)) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, sources: payload.sources }
                        : m,
                    ),
                  )
                } else if (eventName === "error") {
                  throw new Error(payload.error || "Stream error")
                }
                // "done" → server closes the stream; loop exits naturally.
              } catch (parseErr) {
                if (eventName === "error") throw parseErr
                // Other parse failures: skip the frame silently.
              }
            }

            sepIdx = buffer.indexOf("\n\n")
          }
        }
      } catch (err) {
        // AbortError is expected when classSubjectId changes mid-stream —
        // the reset effect already cleared messages, so don't write back.
        if (err instanceof DOMException && err.name === "AbortError") return
        if (controller.signal.aborted) return

        const msg = err instanceof Error ? err.message : "Something went wrong."
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: `Sorry, I hit an error: ${msg}`,
                  isError: true,
                }
              : m,
          ),
        )
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        // Only flip streaming off if this controller is still the active one
        // — a class-subject switch may have already reset state.
        if (!controller.signal.aborted) {
          setIsStreaming(false)
          setStreamingMessageId(null)
        }
      }
    },
    [classSubjectId, isStreaming, messages],
  )

  return {
    classSubjectId,
    messages,
    input,
    setInput,
    pinnedIds,
    togglePin,
    clearPinned,
    materials,
    isStreaming,
    streamingMessageId,
    send,
    resetChat,
  }
}
