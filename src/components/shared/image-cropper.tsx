import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowClockwiseIcon,
  CheckIcon,
  CornersOutIcon,
  XIcon,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

/**
 * Touch-first crop + rotate for a captured page. Full-screen so thumbs have
 * room; big corner handles; drag inside the box to move it; rotate in 90°
 * steps. Works from the *original* file every time, so re-cropping never
 * compounds quality loss. Exports the crop at full source resolution.
 */

type Rect = { x: number; y: number; w: number; h: number }
type Rotation = 0 | 1 | 2 | 3 // quarter turns clockwise
type DragMode = "move" | "nw" | "ne" | "sw" | "se"

const MIN_SIDE = 48 // working px
const HANDLE = 28 // visual handle diameter
const HIT = 44 // touch target

/** Draw `img` into `ctx` rotated by `r` quarter turns, at `scale`. The
 *  result's top-left is the working-space origin. */
function drawRotated(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  r: Rotation,
  scale: number
) {
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.save()
  if (r === 1) {
    ctx.translate(h, 0)
    ctx.rotate(Math.PI / 2)
  } else if (r === 2) {
    ctx.translate(w, h)
    ctx.rotate(Math.PI)
  } else if (r === 3) {
    ctx.translate(0, w)
    ctx.rotate(-Math.PI / 2)
  }
  ctx.drawImage(img, 0, 0, w, h)
  ctx.restore()
}

function workingSize(img: HTMLImageElement, r: Rotation) {
  const sideways = r === 1 || r === 3
  return {
    w: sideways ? img.naturalHeight : img.naturalWidth,
    h: sideways ? img.naturalWidth : img.naturalHeight,
  }
}

export function ImageCropper({
  file,
  title = "Crop page",
  onCancel,
  onConfirm,
}: {
  file: File
  title?: string
  onCancel: () => void
  onConfirm: (cropped: File) => void
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [rotation, setRotation] = useState<Rotation>(0)
  const [crop, setCrop] = useState<Rect | null>(null)
  const [scale, setScale] = useState(1) // display px per working px
  const [busy, setBusy] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{
    mode: DragMode
    startX: number
    startY: number
    start: Rect
  } | null>(null)

  // Load the source once.
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => {
      setImg(el)
      URL.revokeObjectURL(url)
    }
    el.onerror = () => URL.revokeObjectURL(url)
    el.src = url
  }, [file])

  // Fit the working image inside the stage; re-fit on resize/rotate.
  const fit = useCallback(() => {
    const stage = stageRef.current
    if (!stage || !img) return
    const { w, h } = workingSize(img, rotation)
    const pad = 16
    const s = Math.min(
      (stage.clientWidth - pad * 2) / w,
      (stage.clientHeight - pad * 2) / h,
      1
    )
    setScale(s)
  }, [img, rotation])

  useEffect(() => {
    fit()
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [fit])

  // Reset the crop to the full page whenever the source or rotation changes.
  useEffect(() => {
    if (!img) return
    const { w, h } = workingSize(img, rotation)
    setCrop({ x: 0, y: 0, w, h })
  }, [img, rotation])

  // Paint the display canvas.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const { w, h } = workingSize(img, rotation)
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawRotated(ctx, img, rotation, scale)
  }, [img, rotation, scale])

  const clamp = useCallback(
    (r: Rect): Rect => {
      if (!img) return r
      const { w: W, h: H } = workingSize(img, rotation)
      const w = Math.max(MIN_SIDE, Math.min(r.w, W))
      const h = Math.max(MIN_SIDE, Math.min(r.h, H))
      const x = Math.max(0, Math.min(r.x, W - w))
      const y = Math.max(0, Math.min(r.y, H - h))
      return { x, y, w, h }
    },
    [img, rotation]
  )

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    if (!crop) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: crop }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !img) return
    const dx = (e.clientX - d.startX) / scale
    const dy = (e.clientY - d.startY) / scale
    const s = d.start
    let next: Rect
    switch (d.mode) {
      case "move":
        next = { ...s, x: s.x + dx, y: s.y + dy }
        break
      case "nw":
        next = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy }
        break
      case "ne":
        next = { x: s.x, y: s.y + dy, w: s.w + dx, h: s.h - dy }
        break
      case "sw":
        next = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h + dy }
        break
      case "se":
      default:
        next = { x: s.x, y: s.y, w: s.w + dx, h: s.h + dy }
    }
    // Corner drags must not invert; keep the opposite corner anchored.
    if (d.mode !== "move") {
      const { w: W, h: H } = workingSize(img, rotation)
      const right = d.mode === "ne" || d.mode === "se"
      const bottom = d.mode === "sw" || d.mode === "se"
      const x0 = right ? s.x : Math.min(Math.max(0, next.x), s.x + s.w - MIN_SIDE)
      const y0 = bottom ? s.y : Math.min(Math.max(0, next.y), s.y + s.h - MIN_SIDE)
      const x1 = right ? Math.max(s.x + MIN_SIDE, Math.min(W, s.x + next.w)) : s.x + s.w
      const y1 = bottom ? Math.max(s.y + MIN_SIDE, Math.min(H, s.y + next.h)) : s.y + s.h
      next = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    }
    setCrop(clamp(next))
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const resetCrop = () => {
    if (!img) return
    const { w, h } = workingSize(img, rotation)
    setCrop({ x: 0, y: 0, w, h })
  }

  const confirm = async () => {
    if (!img || !crop || busy) return
    setBusy(true)
    try {
      const out = document.createElement("canvas")
      out.width = Math.round(crop.w)
      out.height = Math.round(crop.h)
      const ctx = out.getContext("2d")
      if (!ctx) return
      ctx.translate(-crop.x, -crop.y)
      drawRotated(ctx, img, rotation, 1)
      const blob = await new Promise<Blob | null>((res) =>
        out.toBlob(res, "image/jpeg", 0.92)
      )
      if (!blob) return
      onConfirm(
        new File([blob], file.name.replace(/\.[^.]+$/, "") + "-crop.jpg", {
          type: "image/jpeg",
        })
      )
    } finally {
      setBusy(false)
    }
  }

  const box = crop && {
    left: crop.x * scale,
    top: crop.y * scale,
    width: crop.w * scale,
    height: crop.h * scale,
  }

  const handle = (mode: DragMode, style: React.CSSProperties) => (
    <div
      role="presentation"
      onPointerDown={onPointerDown(mode)}
      style={{
        position: "absolute",
        width: HIT,
        height: HIT,
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: `${mode}-resize`,
        ...style,
      }}
    >
      <div
        style={{ width: HANDLE, height: HANDLE }}
        className="rounded-full border-[3px] border-white bg-primary shadow-md"
      />
    </div>
  )
  const off = -(HIT / 2)

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <XIcon className="size-5" />
        </button>
        <span className="text-sm font-medium">{title}</span>
        <span className="w-9" />
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden select-none"
        style={{ touchAction: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!img && (
          <p className="text-sm text-white/60">Loading photo…</p>
        )}
        <div className="relative">
          <canvas ref={canvasRef} className="block" />
          {box && (
            <div
              onPointerDown={onPointerDown("move")}
              style={{
                position: "absolute",
                ...box,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                touchAction: "none",
                cursor: "move",
              }}
              className="border-2 border-white"
            >
              {/* Rule-of-thirds guides */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/25" />
                ))}
              </div>
              {handle("nw", { left: off, top: off })}
              {handle("ne", { right: off, top: off })}
              {handle("sw", { left: off, bottom: off })}
              {handle("se", { right: off, bottom: off })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-black px-4 pt-3"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => setRotation(((rotation + 1) % 4) as Rotation)}
          disabled={!img}
        >
          <ArrowClockwiseIcon className="size-4" />
          Rotate
        </Button>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={resetCrop}
          disabled={!img}
        >
          <CornersOutIcon className="size-4" />
          Full page
        </Button>
        <Button
          className="ml-auto"
          onClick={confirm}
          disabled={!img || !crop || busy}
        >
          <CheckIcon className="size-4" />
          {busy ? "Saving…" : "Use this crop"}
        </Button>
      </div>
    </div>
  )
}
