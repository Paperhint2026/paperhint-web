import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  CheckCircleIcon,
  CircleIcon,
  CircleNotchIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SectionMotion,
  SettingsCard,
  SettingsRow,
} from "@/modules/settings/components/settings-primitives"

/** Backend minimum. The meter nudges further; this is the hard gate. */
const MIN_LENGTH = 6

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string }

function strengthOf(pw: string): Strength {
  if (!pw) return { score: 0, label: "" }
  let s = 0
  if (pw.length >= MIN_LENGTH) s++
  if (pw.length >= 10) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++
  const score = Math.min(4, s) as Strength["score"]
  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][score]
  return { score, label }
}

const METER_TONE = [
  "bg-border",
  "bg-destructive",
  "bg-amber-500",
  "bg-chart-2",
  "bg-primary",
]

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoComplete: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {shown ? (
          <EyeSlashIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  )
}

function Requirement({ met, children }: { met: boolean; children: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 text-xs transition-colors",
        met ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <span className="relative grid size-3.5 place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          {met ? (
            <motion.span
              key="on"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
              className="text-primary"
            >
              <CheckCircleIcon weight="fill" className="size-3.5" />
            </motion.span>
          ) : (
            <motion.span
              key="off"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CircleIcon className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {children}
    </li>
  )
}

export function SecuritySection() {
  const reduceMotion = useReducedMotion()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const strength = strengthOf(next)
  const longEnough = next.length >= MIN_LENGTH
  const mixedCase = /[a-z]/.test(next) && /[A-Z]/.test(next)
  const hasSymbol = /\d/.test(next) || /[^A-Za-z0-9]/.test(next)
  const matches = confirm.length > 0 && next === confirm
  const mismatch = confirm.length > 0 && next !== confirm
  const canSubmit =
    !isSaving && current.length > 0 && longEnough && matches && next !== current

  const submit = async () => {
    if (!canSubmit) return
    setIsSaving(true)
    try {
      await apiClient.post("/api/auth/change-password", {
        current_password: current,
        new_password: next,
      })
      toast.success("Password changed")
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change password"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SectionMotion>
      <SettingsCard
        title="Password"
        description="Use something you don't use anywhere else. You stay signed in here after changing it."
        footer={
          <>
            <span className="text-xs text-muted-foreground">
              {next && next === current
                ? "New password must differ from the current one."
                : mismatch
                  ? "The two new passwords don't match yet."
                  : " "}
            </span>
            <Button onClick={submit} disabled={!canSubmit}>
              {isSaving ? (
                <CircleNotchIcon className="size-4 animate-spin" />
              ) : (
                <KeyIcon className="size-4" />
              )}
              {isSaving ? "Changing…" : "Change password"}
            </Button>
          </>
        }
      >
        <SettingsRow
          label="Current password"
          hint="Confirms it's really you."
          htmlFor="settings-current-password"
        >
          <PasswordInput
            id="settings-current-password"
            value={current}
            onChange={setCurrent}
            placeholder="Your current password"
            autoComplete="current-password"
          />
        </SettingsRow>

        <SettingsRow
          label="New password"
          hint="At least six characters. Longer and mixed is stronger."
          htmlFor="settings-new-password"
          align="start"
        >
          <PasswordInput
            id="settings-new-password"
            value={next}
            onChange={setNext}
            placeholder="Choose a new password"
            autoComplete="new-password"
          />

          {/* Strength meter: four segments fill left to right as the score
              climbs, the tone shifting from red through amber to green. */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-border"
                >
                  <motion.span
                    className={cn(
                      "block h-full w-full origin-left rounded-full",
                      METER_TONE[strength.score]
                    )}
                    initial={false}
                    animate={{ scaleX: strength.score >= i ? 1 : 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 400,
                            damping: 32,
                            delay: strength.score >= i ? (i - 1) * 0.04 : 0,
                          }
                    }
                  />
                </span>
              ))}
              <span className="ml-2 min-w-[3.5rem] text-right text-[11px] text-muted-foreground tabular-nums">
                {strength.label}
              </span>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              <Requirement met={longEnough}>At least 6 characters</Requirement>
              <Requirement met={mixedCase}>Upper and lower case</Requirement>
              <Requirement met={hasSymbol}>A number or symbol</Requirement>
              <Requirement met={matches}>Both entries match</Requirement>
            </ul>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Confirm new password"
          hint="Type it once more."
          htmlFor="settings-confirm-password"
        >
          <PasswordInput
            id="settings-confirm-password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Repeat the new password"
            autoComplete="new-password"
          />
        </SettingsRow>
      </SettingsCard>
    </SectionMotion>
  )
}
