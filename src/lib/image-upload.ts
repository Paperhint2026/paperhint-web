/**
 * Client-side image prep shared by every photo-upload surface (answer sheets,
 * question papers, scanned pages).
 *
 * iPhone photos arrive as HEIC, which non-Safari browsers and the server's
 * sharp display-copy step can't decode. Safari — where HEIC files come from —
 * CAN paint them onto a canvas, so HEIC is always re-encoded to JPEG here and
 * the server only ever sees JPEG/PNG/WebP/PDF.
 */

const HEIC_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]

/** Some platforms report an empty file.type for .heic, hence the extension fallback. */
export function isHeic(file: File): boolean {
  return HEIC_TYPES.includes(file.type) || /\.hei[cf]$/i.test(file.name)
}

/** MIME types the server accepts as-is. HEIC is accepted at the picker but
 *  converted before upload — see compressForUpload. */
export const ACCEPTED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]

/** `accept` attribute value: server types plus HEIC so iOS offers originals. */
export const UPLOAD_ACCEPT = [
  ...ACCEPTED_UPLOAD_TYPES,
  "image/heic",
  "image/heif",
  ".heic",
  ".heif",
].join(",")

export function isAcceptedUpload(file: File): boolean {
  return ACCEPTED_UPLOAD_TYPES.includes(file.type) || isHeic(file)
}

export const HEIC_UNSUPPORTED_MESSAGE =
  "This browser can't read HEIC photos — upload from your iPhone, or convert to JPG first"

/**
 * Re-encode an image to JPEG when it's worth it:
 *  - HEIC/HEIF: always (compatibility, not compression), regardless of size.
 *    Rejects on browsers that can't decode HEIC, so a raw HEIC never reaches
 *    the server (it would grade — Gemini reads HEIC — but its review image
 *    couldn't render in the browser).
 *  - Other images: only when larger than `sizeThreshold` and the JPEG shrinks it.
 *  - PDFs and non-images pass through untouched.
 */
export function compressForUpload(
  file: File,
  { maxDim = 3200, quality = 0.92, sizeThreshold = 5 * 1024 * 1024 } = {}
): Promise<File> {
  return new Promise((resolve, reject) => {
    const heic = isHeic(file)
    if (!heic) {
      if (!file.type.startsWith("image/") || file.type === "application/pdf") {
        resolve(file)
        return
      }
      if (file.size <= sizeThreshold) {
        resolve(file)
        return
      }
    }

    const img = new Image()
    const url = URL.createObjectURL(file)
    const failHeic = () => reject(new Error(HEIC_UNSUPPORTED_MESSAGE))

    img.onload = () => {
      URL.revokeObjectURL(url)
      const longest = Math.max(img.width, img.height)
      const scale = longest > maxDim ? maxDim / longest : 1
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        if (heic) failHeic()
        else resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          // HEIC keeps the JPEG even when it's bigger than the source.
          if (blob && (heic || blob.size < file.size)) {
            resolve(
              new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
              })
            )
          } else if (heic) {
            failHeic()
          } else {
            resolve(file)
          }
        },
        "image/jpeg",
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      if (heic) failHeic()
      else resolve(file)
    }
    img.src = url
  })
}
