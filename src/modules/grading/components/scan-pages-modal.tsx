import { useCallback, useEffect, useRef, useState } from "react"
import {
  CameraIcon,
  CheckIcon,
  GripVerticalIcon,
  ImagePlusIcon,
  Loader2Icon,
  SwitchCameraIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { jsPDF } from "jspdf"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface PageImage {
  id: string
  file: File
  preview: string
}

interface ScanPagesModalProps {
  open: boolean
  studentName: string
  onClose: () => void
  onSubmit: (pdfFile: File) => void
}

const supportsGetUserMedia =
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === "function"

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  if (canvas.toBlob) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
  }
  const dataUrl = canvas.toDataURL(type, quality)
  const parts = dataUrl.split(",")
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? type
  const bstr = atob(parts[1])
  const u8 = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i)
  return Promise.resolve(new Blob([u8], { type: mime }))
}

function SortablePageCard({
  page,
  index,
  onRemove,
}: {
  page: PageImage
  index: number
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-[3/4] overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/30",
      )}
    >
      <img
        src={page.preview}
        alt={`Page ${index + 1}`}
        className="size-full object-cover"
        draggable={false}
      />

      <div className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">
        {index + 1}
      </div>

      <button
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 rounded-md bg-background/80 p-1.5 text-muted-foreground shadow backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
      >
        <GripVerticalIcon className="size-4" />
      </button>

      <button
        onClick={onRemove}
        className="absolute bottom-2 right-2 rounded-md bg-destructive/90 p-1.5 text-destructive-foreground shadow transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  )
}

export function ScanPagesModal({ open, studentName, onClose, onSubmit }: ScanPagesModalProps) {
  const [pages, setPages] = useState<PageImage[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [flashEffect, setFlashEffect] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nativeCameraRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(
    async (facing: "environment" | "user") => {
      stopCamera()
      setCameraError(null)

      if (!supportsGetUserMedia) {
        setCameraError("Camera not supported in this browser. Use Gallery instead.")
        return
      }

      const constraints: MediaStreamConstraints = {
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
          streamRef.current = fallbackStream
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream
          }
        } catch {
          setCameraError("Could not access camera. Please check permissions or use Gallery.")
        }
      }
    },
    [stopCamera],
  )

  useEffect(() => {
    if (!supportsGetUserMedia) return
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === "videoinput")
      setHasMultipleCameras(videoInputs.length > 1)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (cameraActive) {
      startCamera(facingMode)
    }
    return () => {
      if (!cameraActive) stopCamera()
    }
  }, [cameraActive, facingMode, startCamera, stopCamera])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setCameraActive(false)
      setCameraError(null)
    }
  }, [open, stopCamera])

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    setFlashEffect(true)
    setTimeout(() => setFlashEffect(false), 200)

    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92)
    if (!blob) return
    const file = new File([blob], `page-${Date.now()}.jpg`, { type: "image/jpeg" })
    const preview = URL.createObjectURL(blob)
    setPages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, preview },
    ])
  }, [])

  const toggleFacing = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
  }, [])

  const exitCamera = useCallback(() => {
    stopCamera()
    setCameraActive(false)
  }, [stopCamera])

  const handleCameraClick = useCallback(() => {
    if (supportsGetUserMedia) {
      setCameraActive(true)
    } else {
      nativeCameraRef.current?.click()
    }
  }, [])

  const addImages = useCallback((files: FileList | File[]) => {
    const newPages: PageImage[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        preview: URL.createObjectURL(f),
      }))
    setPages((prev) => [...prev, ...newPages])
  }, [])

  const removePage = (id: string) => {
    setPages((prev) => {
      const page = prev.find((p) => p.id === id)
      if (page) URL.revokeObjectURL(page.preview)
      return prev.filter((p) => p.id !== id)
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPages((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id)
        const newIndex = prev.findIndex((p) => p.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleConvertAndUpload = async () => {
    if (pages.length === 0) return
    setIsConverting(true)

    try {
      const pdf = new jsPDF({ unit: "px", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage()

        const imgData = await loadImageAsDataUrl(pages[i].file)
        const dims = await getImageDimensions(pages[i].preview)

        const ratio = Math.min(pageWidth / dims.width, pageHeight / dims.height)
        const w = dims.width * ratio
        const h = dims.height * ratio
        const x = (pageWidth - w) / 2
        const y = (pageHeight - h) / 2

        pdf.addImage(imgData, "JPEG", x, y, w, h)
      }

      const blob = pdf.output("blob")
      const file = new File([blob], `answer-sheet-${Date.now()}.pdf`, {
        type: "application/pdf",
      })

      pages.forEach((p) => URL.revokeObjectURL(p.preview))
      setPages([])
      onSubmit(file)
    } catch (err) {
      console.error("PDF conversion failed:", err)
    } finally {
      setIsConverting(false)
    }
  }

  const handleClose = () => {
    stopCamera()
    setCameraActive(false)
    pages.forEach((p) => URL.revokeObjectURL(p.preview))
    setPages([])
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* eslint-disable-next-line tailwindcss/no-contradicting-classname -- 100vh is the fallback for browsers without dvh support */}
      <div
        className={cn(
          "relative flex w-full flex-col overflow-hidden bg-background shadow-2xl",
          cameraActive
            ? "h-[100vh] h-[100dvh] rounded-none"
            : "max-h-[90vh] max-h-[90dvh] rounded-t-2xl sm:max-w-lg sm:rounded-2xl",
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold sm:text-base">
              {cameraActive ? "Capture Pages" : "Scan Answer Pages"}
            </h2>
            <p className="text-xs text-muted-foreground">{studentName}</p>
          </div>
          <button onClick={handleClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <XIcon className="size-4" />
          </button>
        </div>

        {/* Camera view */}
        {cameraActive ? (
          <div className="relative flex min-h-0 flex-1 flex-col bg-black">
            {cameraError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <CameraIcon className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-red-400">{cameraError}</p>
                <Button size="sm" variant="secondary" onClick={exitCamera}>
                  Go Back
                </Button>
              </div>
            ) : (
              <>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 size-full object-cover"
                  />
                  {flashEffect && (
                    <div className="absolute inset-0 bg-white/70 transition-opacity duration-150" />
                  )}
                  {pages.length > 0 && (
                    <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
                      {pages.length} page{pages.length > 1 ? "s" : ""} captured
                    </div>
                  )}
                </div>

                <div
                  className="flex shrink-0 items-center justify-center gap-6 bg-black/90 px-4 py-4"
                  style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
                >
                  {hasMultipleCameras ? (
                    <button
                      onClick={toggleFacing}
                      className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:bg-white/30"
                    >
                      <SwitchCameraIcon className="size-5" />
                    </button>
                  ) : (
                    <div className="size-11" />
                  )}

                  <button
                    onClick={capturePhoto}
                    className="flex size-16 items-center justify-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-90"
                  >
                    <div className="size-12 rounded-full bg-white" />
                  </button>

                  <button
                    onClick={exitCamera}
                    className="flex size-11 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700"
                  >
                    <CheckIcon className="size-5" />
                  </button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <>
            {/* Pages grid */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {pages.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
                    <ImagePlusIcon className="size-8 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No pages added yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Take photos or upload images of the answer sheet pages
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    {pages.length} page{pages.length > 1 ? "s" : ""} — drag to reorder
                  </p>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {pages.map((page, idx) => (
                          <SortablePageCard
                            key={page.id}
                            page={page}
                            index={idx}
                            onRemove={() => removePage(page.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </div>

            {/* Footer actions */}
            <div
              className="flex shrink-0 flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:px-5"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
            >
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCameraClick}
                >
                  <CameraIcon className="mr-1.5 size-4" />
                  Camera
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlusIcon className="mr-1.5 size-4" />
                  Gallery
                </Button>
              </div>

              {pages.length > 0 && (
                <Button
                  disabled={isConverting}
                  onClick={handleConvertAndUpload}
                  className="w-full"
                >
                  {isConverting ? (
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                  ) : (
                    <UploadIcon className="mr-2 size-4" />
                  )}
                  {isConverting
                    ? "Converting to PDF..."
                    : `Upload ${pages.length} Page${pages.length > 1 ? "s" : ""}`}
                </Button>
              )}
            </div>

            {/* Native camera fallback for browsers without getUserMedia */}
            <input
              ref={nativeCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addImages(e.target.files)
                e.target.value = ""
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addImages(e.target.files)
                e.target.value = ""
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}

function loadImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => resolve({ width: 800, height: 1000 })
    img.src = src
  })
}
