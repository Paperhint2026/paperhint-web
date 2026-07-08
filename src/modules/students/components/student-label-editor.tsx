import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { XIcon, PencilIcon, Loader2Icon, PlusIcon } from "lucide-react"
import { apiClient } from "@/lib/api-client"

export interface StudentLabelEditorProps {
  studentId: string
  label: string | null
  onLabelUpdated?: (newLabel: string | null) => void
  className?: string
}

// Note: You might want to debounce onLabelUpdated in parent if list is large

export function StudentLabelEditor({
  studentId,
  label,
  onLabelUpdated,
  className,
}: StudentLabelEditorProps) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(label || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setInput(label || "")
  }, [label])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function handleStartEdit() {
    setEditing(true)
    setError(null)
  }

  function handleCancel() {
    setEditing(false)
    setInput(label || "")
    setError(null)
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = input.trim()
    if (trimmed.length === 0) {
      await handleClear()
      return
    }
    if (trimmed.length > 50) {
      setError("Max 50 characters")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.put<{ id: string; label: string }>(
        "/api/student-labels",
        {
          student_id: studentId,
          label: trimmed,
        }
      )
      setEditing(false)
      setInput(res.label)
      if (onLabelUpdated) onLabelUpdated(res.label)
    } catch (err: any) {
      setError(
        err?.message ||
        (typeof err === "string"
          ? err
          : "Failed to save label")
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleClear() {
    setLoading(true)
    setError(null)
    try {
      await apiClient.delete<{ success: boolean }>(
        `/api/student-labels/${studentId}`
      )
      setEditing(false)
      setInput("")
      if (onLabelUpdated) onLabelUpdated(null)
    } catch (err: any) {
      setError(
        err?.message ||
        (typeof err === "string"
          ? err
          : "Failed to clear label")
      )
    } finally {
      setLoading(false)
    }
  }

  // Only show pencil if label exists
  if (!editing) {
    return (
      <span className={className}>
        {label ? (
          <span className="inline-flex items-center gap-1">
            <Badge className="bg-muted text-foreground pr-1">{label}</Badge>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={loading}
              className="size-6 p-0 ml-0.5"
              aria-label="Edit label"
              onClick={handleStartEdit}
            >
              <PencilIcon className="size-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={loading}
              className="size-6 p-0 ml-0.5"
              aria-label="Clear label"
              onClick={handleClear}
            >
              <XIcon className="size-4 text-muted-foreground" />
            </Button>
          </span>
        ) : (
          <Button
            variant="link"
            size="sm"
            className="px-1 py-0 h-5 rounded"
            type="button"
            disabled={loading}
            onClick={handleStartEdit}
            aria-label="Add label"
          >
            <PlusIcon className="size-3 mr-0.5 inline align-middle" />
            <span className="text-xs">Add label</span>
          </Button>
        )}
      </span>
    )
  }

  return (
    <form
      className={className + " inline-flex items-center gap-1"}
      onSubmit={handleSave}
    >
      <Input
        ref={inputRef}
        className="w-32 h-7 px-2 text-xs"
        value={input}
        maxLength={50}
        placeholder="Enter label..."
        autoFocus
        disabled={loading}
        onChange={e => {
          setInput(e.target.value)
          setError(null)
        }}
        onKeyDown={e => {
          if (e.key === "Escape") {
            e.preventDefault()
            handleCancel()
          }
        }}
        aria-label="Student label"
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={loading || input.trim().length === 0}
        className="size-6 p-0"
        aria-label="Save label"
      >
        {loading ? (
          <Loader2Icon className="animate-spin size-4 text-muted-foreground" />
        ) : (
          <PencilIcon className="size-4 text-muted-foreground" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCancel}
        disabled={loading}
        className="size-6 p-0"
        aria-label="Cancel"
      >
        <XIcon className="size-4 text-muted-foreground" />
      </Button>
      {error && (
        <span className="text-destructive text-xs ml-2">{error}</span>
      )}
    </form>
  )
}
