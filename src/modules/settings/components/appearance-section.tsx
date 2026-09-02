import { motion, useReducedMotion } from "motion/react"
import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import {
  SectionMotion,
  SettingsCard,
} from "@/modules/settings/components/settings-primitives"

type ThemeChoice = "light" | "dark" | "system"

/**
 * Thumbnail palettes. These are the one place in the app that paints literal
 * colours: a "Light" preview must look light even while the app is dark, so
 * it cannot read the live tokens. Values mirror `--sidebar` / `--background`
 * / `--foreground` in index.css for each theme.
 */
const SWATCH = {
  light: {
    ground: "oklch(0.962 0.004 85)",
    card: "oklch(1 0 0)",
    ink: "oklch(0.25 0.006 85)",
    faint: "oklch(0.88 0.005 85)",
  },
  dark: {
    ground: "oklch(0.175 0.006 85)",
    card: "oklch(0.238 0.007 85)",
    ink: "oklch(0.93 0.004 85)",
    faint: "oklch(0.34 0.006 85)",
  },
}

/** A tiny app shell: ground, sidebar lines, and a floating content card. */
function ThemeThumb({ tone }: { tone: keyof typeof SWATCH }) {
  const c = SWATCH[tone]
  return (
    <div
      aria-hidden
      className="flex h-full w-full gap-1.5 p-2"
      style={{ background: c.ground }}
    >
      <div className="flex w-1/4 flex-col gap-1 pt-0.5">
        <span
          className="h-1.5 w-3/4 rounded-full"
          style={{ background: c.ink, opacity: 0.8 }}
        />
        <span
          className="h-1 w-full rounded-full"
          style={{ background: c.faint }}
        />
        <span
          className="h-1 w-5/6 rounded-full"
          style={{ background: c.faint }}
        />
        <span
          className="h-1 w-full rounded-full"
          style={{ background: c.faint }}
        />
      </div>
      <div
        className="flex flex-1 flex-col gap-1.5 rounded-[5px] p-2"
        style={{ background: c.card }}
      >
        <span
          className="h-1.5 w-1/2 rounded-full"
          style={{ background: c.ink, opacity: 0.85 }}
        />
        <span
          className="h-1 w-3/4 rounded-full"
          style={{ background: c.faint }}
        />
        <div className="mt-auto flex gap-1">
          <span
            className="h-4 flex-1 rounded-[3px]"
            style={{ background: c.faint }}
          />
          <span
            className="h-4 flex-1 rounded-[3px]"
            style={{ background: c.faint }}
          />
        </div>
      </div>
    </div>
  )
}

const CHOICES: {
  id: ThemeChoice
  label: string
  hint: string
  icon: typeof SunIcon
}[] = [
  {
    id: "light",
    label: "Light",
    hint: "Bright ground, dark ink.",
    icon: SunIcon,
  },
  {
    id: "dark",
    label: "Dark",
    hint: "Easier on the eyes at night.",
    icon: MoonIcon,
  },
  {
    id: "system",
    label: "System",
    hint: "Follows your device setting.",
    icon: MonitorIcon,
  },
]

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const reduceMotion = useReducedMotion()

  return (
    <SectionMotion>
      <SettingsCard
        title="Theme"
        description="Pick how Paperhint looks. The page crossfades when you switch."
        footer={
          <span className="text-xs text-muted-foreground">
            Tip: press{" "}
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground shadow-xs">
              D
            </kbd>{" "}
            anywhere in the app to flip between light and dark.
          </span>
        }
      >
        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid gap-3 px-5 py-5 sm:grid-cols-3"
        >
          {CHOICES.map((c) => {
            const selected = theme === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(c.id)}
                className={cn(
                  "group relative flex flex-col rounded-xl border bg-background text-left transition-[transform,box-shadow,border-color] outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  // The sliding ring is the only outline when selected; the
                  // card's own border goes clear so the two never double up.
                  selected
                    ? "border-transparent shadow-sm"
                    : "border-border hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
                )}
              >
                {selected ? (
                  <motion.span
                    aria-hidden
                    layoutId="settings-theme-ring"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 480, damping: 38 }
                    }
                    // Sits exactly on the border line (-inset-px), so it
                    // replaces the border rather than tracing inside it.
                    className="pointer-events-none absolute -inset-px rounded-xl ring-2 ring-primary"
                  />
                ) : null}

                <div className="relative h-24 overflow-hidden rounded-t-[calc(var(--radius-xl)-1px)] border-b border-border">
                  {c.id === "system" ? (
                    // Split diagonally: light on the left, dark on the right.
                    <>
                      <div className="absolute inset-0">
                        <ThemeThumb tone="light" />
                      </div>
                      <div
                        className="absolute inset-0"
                        style={{
                          clipPath:
                            "polygon(62% 0, 100% 0, 100% 100%, 38% 100%)",
                        }}
                      >
                        <ThemeThumb tone="dark" />
                      </div>
                    </>
                  ) : (
                    <ThemeThumb tone={c.id} />
                  )}
                </div>

                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <c.icon
                    weight={selected ? "fill" : "regular"}
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      selected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-sm font-medium text-foreground">
                      {c.label}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {c.hint}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-transparent group-hover:border-foreground/30"
                    )}
                  >
                    <CheckIcon weight="bold" className="size-3" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </SettingsCard>
    </SectionMotion>
  )
}
