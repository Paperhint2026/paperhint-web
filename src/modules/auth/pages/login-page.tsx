import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowRightIcon,
  CircleNotchIcon,
  EyeIcon,
  EyeSlashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { PaperhintMark } from "@/components/shared/paperhint-mark"
import { PaperhintWordmark } from "@/components/shared/paperhint-wordmark"
import { Sticker, type StickerName } from "@/components/shared/sticker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoginScene } from "../components/login-scene"

type Mood =
  | "idle"
  | "email"
  | "password"
  | "peeking"
  | "sending"
  | "error"
  | "success"
  | "found"

/* The greeter reacts to what you're doing — it's the one bit of the page
   that talks back. */
const MOOD_STICKER: Record<Mood, StickerName> = {
  idle: "wave",
  email: "greet",
  password: "peek",
  peeking: "wink",
  sending: "run",
  error: "worried",
  success: "excited",
  found: "cool",
}

const MOOD_LINE: Record<Mood, string> = {
  idle: "Welcome back.",
  email: "Which address do you use?",
  password: "I'm not looking, promise.",
  peeking: "Okay, I'm looking a little.",
  sending: "Opening your classes…",
  error: "Hmm, that didn't match.",
  success: "There you are. Come on in.",
  found: "You found me. Hi.",
}

function partOfDay() {
  const h = new Date().getHours()
  if (h < 5 || h >= 21) return "Working late"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

const ENTER = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [focus, setFocus] = useState<"email" | "password" | null>(null)
  const [phase, setPhase] = useState<"form" | "sending" | "success">("form")
  const [found, setFound] = useState(false)
  const [logoSpin, setLogoSpin] = useState(0)
  const taps = useRef(0)

  useEffect(() => {
    if (!found) return
    const t = setTimeout(() => setFound(false), 2600)
    return () => clearTimeout(t)
  }, [found])

  if (isAuthenticated && phase === "form") {
    return <Navigate to="/" replace />
  }

  const mood: Mood =
    phase === "success"
      ? "success"
      : phase === "sending"
        ? "sending"
        : found
          ? "found"
          : error
            ? "error"
            : focus === "password"
              ? showPassword
                ? "peeking"
                : "password"
              : focus === "email"
                ? "email"
                : "idle"

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setPhase("sending")
    try {
      await login({ email, password })
      setPhase("success")
      setTimeout(() => navigate("/", { replace: true }), reduceMotion ? 0 : 700)
    } catch (err) {
      setPhase("form")
      const msg = err instanceof Error ? err.message : ""
      if (
        /invalid.*credential/i.test(msg) ||
        /request failed.*40[01]/i.test(msg)
      ) {
        setError("That email and password don't match. Try again.")
      } else if (/email.*not.*confirmed/i.test(msg)) {
        setError("Your email isn't confirmed yet. Check your inbox.")
      } else if (/too many/i.test(msg) || /rate/i.test(msg)) {
        setError("Too many tries. Give it a minute and try again.")
      } else {
        setError(msg || "Something went wrong. Please try again.")
      }
    }
  }

  /* Easter egg: tap the greeter three times and it lets on. */
  const tapGreeter = () => {
    taps.current += 1
    if (taps.current >= 3) {
      taps.current = 0
      setFound(true)
      toast("You found the greeter.", {
        description: "It watches the password field very carefully.",
      })
    }
  }

  const busy = isLoading || phase !== "form"

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── Form half ── */}
      <div className="relative flex flex-col p-6 md:p-10">
        <Link
          to="/"
          onClick={() => setLogoSpin((n) => n + 1)}
          className="flex w-fit items-center gap-2"
          aria-label="Paperhint"
        >
          <span
            key={logoSpin}
            className={cn(
              "grid size-7 place-items-center",
              logoSpin > 0 &&
                !reduceMotion &&
                "[animation:login-spin-once_.7s_cubic-bezier(.2,.8,.2,1)]"
            )}
          >
            <PaperhintMark className="size-7 text-primary" />
          </span>
          <PaperhintWordmark className="text-[21px]" />
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.form
            onSubmit={handleSubmit}
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: reduceMotion ? 0 : 0.07 }}
            className="flex w-full max-w-sm flex-col gap-7"
          >
            {/* Greeter */}
            <motion.div variants={ENTER} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={tapGreeter}
                aria-label="Say hi"
                className="group relative w-fit outline-none"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={MOOD_STICKER[mood]}
                    initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.7, rotate: 8 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24 }}
                    className="block transition-transform group-hover:-translate-y-0.5 group-active:scale-95"
                  >
                    <Sticker name={MOOD_STICKER[mood]} size={92} />
                  </motion.span>
                </AnimatePresence>
              </button>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-muted-foreground">{partOfDay()}</p>
                <h1 className="text-[2rem] leading-[1.05] font-medium tracking-[-0.04em] text-foreground">
                  Sign in to your{" "}
                  <span className="text-primary">
                    <em className="font-serif font-medium tracking-normal italic">
                      s
                    </em>
                    chool
                  </span>
                  .
                </h1>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={mood}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className={cn(
                      "text-sm",
                      mood === "error"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {MOOD_LINE[mood]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Fields */}
            <motion.div variants={ENTER} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-secondary-foreground">
                  Email
                </span>
                <Input
                  type="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError("")
                  }}
                  onFocus={() => setFocus("email")}
                  onBlur={() => setFocus(null)}
                  required
                  autoComplete="email"
                  autoFocus
                  disabled={busy}
                  className="h-11 rounded-xl border-[1.5px] px-3.5 text-[14.5px] transition-shadow focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center text-[13px] font-medium text-secondary-foreground">
                  Password
                  <Link
                    to="/forgot-password"
                    tabIndex={-1}
                    className="ml-auto font-normal text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    Forgot it?
                  </Link>
                </span>
                <span className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError("")
                    }}
                    onFocus={() => setFocus("password")}
                    onBlur={() => setFocus(null)}
                    required
                    autoComplete="current-password"
                    disabled={busy}
                    className="h-11 rounded-xl border-[1.5px] px-3.5 pr-11 text-[14.5px] transition-shadow focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    onMouseDown={(e) => e.preventDefault()}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </span>
              </label>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 overflow-hidden text-sm text-destructive"
                  >
                    <WarningCircleIcon
                      weight="fill"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div variants={ENTER} className="flex flex-col gap-4">
              <Button
                type="submit"
                size="lg"
                disabled={busy}
                className={cn(
                  "h-11 rounded-xl text-[15px] shadow-[0_8px_24px_-8px_rgba(11,138,92,.55)] transition-all hover:-translate-y-px hover:shadow-[0_14px_30px_-8px_rgba(11,138,92,.6)]",
                  phase === "success" && "bg-primary"
                )}
              >
                {phase === "sending" ? (
                  <>
                    <CircleNotchIcon className="animate-spin" />
                    Opening your classes…
                  </>
                ) : phase === "success" ? (
                  "Welcome back"
                ) : (
                  <>
                    Sign in
                    <ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                New here? Your school admin sends the invite. Check your inbox
                for one.
              </p>
            </motion.div>
          </motion.form>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} Paperhint
        </p>
      </div>

      {/* ── Scene half ── */}
      <div className="relative hidden lg:block">
        <LoginScene celebrating={phase === "success"} />
      </div>
    </div>
  )
}
