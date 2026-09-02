import { cn } from "@/lib/utils"

/**
 * Die-cut mascots lifted from the marketing site (paperhint-site,
 * `public/assets/img/stickers`). Filenames are kept byte-identical across the
 * two repos so refreshing the set stays a plain copy — the readable names
 * below are aliases over that shared vocabulary, never a rename. If a name
 * reads wrong for the art, change the key here; the file keeps its number.
 *
 * Small mascots are transparent PNGs; the four scenes ship as WebP only,
 * which is where the site's `<picture>` fallback would have landed anyway.
 */
const STICKER_ART = {
  // Die-cut characters — all 254x254 since the sheet was re-exported, so the
  // component's ratio maths is a no-op for these and only matters for scenes.
  hint: { file: "char-01.png", w: 254, h: 254 },
  run: { file: "char-02.png", w: 254, h: 254 },
  unimpressed: { file: "char-03.png", w: 254, h: 254 },
  peace: { file: "char-04.png", w: 254, h: 254 },
  point: { file: "char-05.png", w: 254, h: 254 },
  greet: { file: "char-06.png", w: 254, h: 254 },
  excited: { file: "char-07.png", w: 254, h: 254 },
  angry: { file: "char-08.png", w: 254, h: 254 },
  worried: { file: "char-09.png", w: 254, h: 254 },
  star: { file: "char-10.png", w: 254, h: 254 },
  // Was the sad, sweating diamond; the re-export made it a cheerful one
  // raising a finger, so the name had to follow the art.
  idea: { file: "char-11.png", w: 254, h: 254 },
  happy: { file: "char-12.png", w: 254, h: 254 },
  wave: { file: "char-13.png", w: 254, h: 254 },
  wink: { file: "char-14.png", w: 254, h: 254 },
  peek: { file: "char-15.png", w: 254, h: 254 },
  sleep: { file: "char-16.png", w: 254, h: 254 },
  cloud: { file: "char-17.png", w: 254, h: 254 },
  drop: { file: "char-18.png", w: 254, h: 254 },
  dash: { file: "char-19.png", w: 254, h: 254 },
  plus: { file: "char-20.png", w: 254, h: 254 },
  error: { file: "char-21.png", w: 254, h: 254 },
  arrow: { file: "char-22.png", w: 254, h: 254 },
  cool: { file: "char-23.png", w: 254, h: 254 },
  // New in the re-export — a second pink up-arrow, near-identical to `arrow`.
  "arrow-alt": { file: "char-24.png", w: 254, h: 254 },
  // Full scenes — these want a few hundred pixels, not the 96px default.
  classroom: { file: "classroom-gang.webp", w: 1100, h: 608 },
  friends: { file: "friends-group.webp", w: 1000, h: 666 },
  lost: { file: "lost-kid.webp", w: 760, h: 1036 },
  mail: { file: "mail-mascot.webp", w: 778, h: 967 },
} as const

export type StickerName = keyof typeof STICKER_ART

export function Sticker({
  name,
  size = 96,
  className,
}: {
  name: StickerName
  /** Longest edge, in px. The other edge follows the art's own ratio. */
  size?: number
  className?: string
}) {
  const art = STICKER_ART[name]
  const scale = size / Math.max(art.w, art.h)

  return (
    <img
      // Decorative by definition — the sentence beside it carries the meaning,
      // and "yellow star mascot" read between "No exams yet" and "Create one"
      // is noise.
      alt=""
      aria-hidden
      loading="lazy"
      src={`/stickers/${art.file}`}
      // Explicit dimensions so the box is reserved before the art arrives.
      width={Math.round(art.w * scale)}
      height={Math.round(art.h * scale)}
      className={cn("select-none", className)}
    />
  )
}
