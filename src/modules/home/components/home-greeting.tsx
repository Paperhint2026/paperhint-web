import { useEffect, useState } from "react"
import dayjs from "dayjs"

import { Sticker, type StickerName } from "@/components/shared/sticker"

/** Time-of-day greeting with a mascot to match. Midnight to 5am is its own
 *  bucket — "Good morning" at 1am reads as a bug. */
function partOfDay(hour: number): { word: string; sticker: StickerName } {
  if (hour < 5) return { word: "Working late", sticker: "sleep" }
  if (hour < 12) return { word: "Good morning", sticker: "wave" }
  if (hour < 17) return { word: "Good afternoon", sticker: "happy" }
  if (hour < 21) return { word: "Good evening", sticker: "cool" }
  return { word: "Working late", sticker: "sleep" }
}

/** The current hour, re-read every minute so a page left open rolls over. */
function useHour() {
  const [hour, setHour] = useState(() => dayjs().hour())
  useEffect(() => {
    const id = setInterval(() => setHour(dayjs().hour()), 60_000)
    return () => clearInterval(id)
  }, [])
  return hour
}

export function HomeGreeting({
  name,
  summary,
  aside,
}: {
  name: string
  /** One line under the greeting that says what today looks like. */
  summary?: React.ReactNode
  /** Right-hand slot on the greeting row — a stat strip, usually. */
  aside?: React.ReactNode
}) {
  const { word, sticker } = partOfDay(useHour())
  return (
    <div className="flex flex-wrap items-center gap-5 sm:gap-6">
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <Sticker
          name={sticker}
          size={80}
          className="hidden shrink-0 sm:block"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            {dayjs().format("dddd, D MMMM")}
          </p>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {word},{" "}
            <em className="font-serif font-medium text-primary italic">
              {name}
            </em>
          </h1>
          {summary ? (
            <p className="text-sm text-muted-foreground">{summary}</p>
          ) : null}
        </div>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  )
}

/** Three or four numbers on one hairline-divided strip, for the greeting row. */
export function StatStrip({
  items,
}: {
  items: { value: React.ReactNode; label: string; accent?: boolean }[]
}) {
  return (
    <div className="flex divide-x divide-border rounded-xl border border-border bg-background">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex min-w-[5.5rem] flex-col items-center gap-0.5 px-4 py-2.5"
        >
          <span
            className={
              it.accent
                ? "text-lg leading-tight font-semibold text-amber-600 tabular-nums dark:text-amber-400"
                : "text-lg leading-tight font-semibold text-foreground tabular-nums"
            }
          >
            {it.value}
          </span>
          <span className="text-[11px] text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
