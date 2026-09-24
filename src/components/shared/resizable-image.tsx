import { useRef, useState } from "react"
import Image from "@tiptap/extension-image"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import { TrashIcon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/**
 * Inline image with Gmail-style resizing: select the picture and you get
 * BOTH corner drag-handles (freeform, pointer-events so touch works) and a
 * preset toolbar (Small / Medium / Full width) plus Remove.
 *
 * Persistence: the body is markdown, and standard `![alt](src)` can't carry
 * a width — so the size rides as an alt-text marker, `![alt|w=64](src)`,
 * any percent 10–100. The serializer writes it, this NodeView reads it
 * back, and the app's markdown renderer (NotesMarkdown) interprets it —
 * the server never has to know.
 */

export const WIDTH_PRESETS = [
  { value: 33, label: "Small" },
  { value: 50, label: "Medium" },
  { value: 100, label: "Full width" },
] as const

const MIN_W = 10
const MAX_W = 100

/** "alt|w=50" → { alt: "alt", width: 50 }. */
export function parseAltMarker(raw: string | null | undefined) {
  const text = raw ?? ""
  const m = text.match(/^(.*?)\|w=(\d{1,3})$/)
  if (!m) return { alt: text, width: 100 }
  const width = Math.min(MAX_W, Math.max(MIN_W, Number(m[2])))
  return { alt: m[1], width }
}

const HANDLES = [
  { corner: "nw", className: "-top-1.5 -left-1.5 cursor-nwse-resize", sign: -1 },
  { corner: "ne", className: "-top-1.5 -right-1.5 cursor-nesw-resize", sign: 1 },
  { corner: "sw", className: "-bottom-1.5 -left-1.5 cursor-nesw-resize", sign: -1 },
  { corner: "se", className: "-bottom-1.5 -right-1.5 cursor-nwse-resize", sign: 1 },
] as const

function ImageView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { alt, width } = parseAltMarker(node.attrs.alt as string)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // Live width during a drag — committed to the document only on release,
  // so a long drag is one undo step, not hundreds.
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const shownWidth = dragWidth ?? width

  const commitWidth = (w: number) => {
    const rounded = Math.min(MAX_W, Math.max(MIN_W, Math.round(w)))
    updateAttributes({ alt: rounded === 100 ? alt : `${alt}|w=${rounded}` })
  }

  const startDrag = (e: React.PointerEvent, sign: 1 | -1) => {
    e.preventDefault()
    e.stopPropagation()
    const container = wrapperRef.current
    if (!container) return
    const containerPx = container.getBoundingClientRect().width
    if (!containerPx) return
    const startX = e.clientX
    const startW = shownWidth
    let latest = startW

    const onMove = (ev: PointerEvent) => {
      // Left-side handles resize mirrored: dragging outward grows the image.
      const deltaPct = ((ev.clientX - startX) * sign * 100) / containerPx
      latest = Math.min(MAX_W, Math.max(MIN_W, startW + deltaPct))
      setDragWidth(latest)
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      setDragWidth(null)
      commitWidth(latest)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  return (
    <NodeViewWrapper ref={wrapperRef} className="my-2">
      {/* The frame hugs the image so handles sit on ITS corners. */}
      <div
        className="relative inline-block max-w-full align-top"
        style={{ width: `${shownWidth}%` }}
        contentEditable={false}
      >
        <img
          src={node.attrs.src as string}
          alt={alt}
          className={cn(
            "block w-full cursor-pointer rounded-lg border transition-shadow",
            selected && "ring-2 ring-primary/60"
          )}
          draggable={false}
          data-drag-handle
        />

        {selected && (
          <>
            {/* Corner drag handles — pointer events, so touch drags work. */}
            {HANDLES.map((h) => (
              <span
                key={h.corner}
                role="presentation"
                onPointerDown={(e) => startDrag(e, h.sign)}
                className={cn(
                  "absolute z-10 size-3 touch-none rounded-[3px] border-2 border-background bg-primary shadow",
                  h.className
                )}
              />
            ))}

            {/* Live size badge while dragging */}
            {dragWidth !== null && (
              <span className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background tabular-nums">
                {Math.round(dragWidth)}%
              </span>
            )}

            {/* Preset toolbar, Gmail-style — overlaid on the bottom edge so
                the editor's overflow clipping can never cut it off */}
            {dragWidth === null && (
              <div className="absolute bottom-2 left-2 z-10 flex items-center gap-0.5 rounded-lg border bg-background/95 p-0.5 shadow-md backdrop-blur">
                {WIDTH_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => commitWidth(p.value)}
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                      width === p.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="mx-0.5 h-4 w-px bg-border" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => deleteNode()}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const ResizableImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})
