import { useState } from "react"
import { Link } from "react-router-dom"
import {
  BuildingsIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ExamIcon,
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { supabase } from "@/lib/supabase"
import { showError } from "@/lib/show-error"
import { isDisposableEmail, suggestEmailFix } from "@/lib/email-validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SIGNUP_INTENT_KEY = "paperhint.signup_intent"

type Kind = "solo" | "coaching"

/**
 * `/signup` — three plan cards (Solo enabled, Coaching disabled with a
 * "coming soon" badge, School shows the sales path). Once a plan is picked,
 * three ways to actually create the account: Google, Microsoft, or email +
 * password (with a confirmation link).
 */
export function SignupPage() {
  const [picked, setPicked] = useState<Kind | null>(null)

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-2">
        <ExamIcon className="size-6 text-primary" weight="fill" />
        <span className="text-lg font-semibold">
          Paper<span className="text-primary">hint</span>
        </span>
      </div>

      {!picked ? (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Get started
            </h1>
            <p className="text-sm text-muted-foreground">
              Every teacher deserves a second pair of hands. Pick how you
              teach.
            </p>
          </div>
          <div className="grid gap-3">
            <PlanCard
              icon={UserIcon}
              title="I'm a teacher at a school"
              hint="Your own workspace: your classes, your notes, your students. Great for a teacher whose school isn't on Paperhint yet."
              onClick={() => setPicked("solo")}
            />
            <PlanCard
              icon={BuildingsIcon}
              title="I run tuition or coaching classes"
              hint="Multiple batches, your own schedule, per-batch attendance."
              badge="Coming soon"
              disabled
            />
            <PlanCard
              icon={BuildingsIcon}
              title="I'm setting up a school"
              hint="For principals and school offices — teachers, allotments, timetable, all of it."
              cta="Talk to us"
              href="mailto:hello@paperhint.com?subject=Schools onboarding"
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <SignupForm kind={picked} onBack={() => setPicked(null)} />
      )}
    </div>
  )
}

function PlanCard({
  icon: Icon,
  title,
  hint,
  onClick,
  disabled,
  badge,
  cta,
  href,
}: {
  icon: React.ComponentType<{ className?: string; weight?: "regular" | "fill" }>
  title: string
  hint: string
  onClick?: () => void
  disabled?: boolean
  badge?: string
  cta?: string
  href?: string
}) {
  const content = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {badge}
            </span>
          )}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </span>
      </span>
      {cta && (
        <span className="mt-1 shrink-0 text-xs font-medium text-primary">
          {cta} →
        </span>
      )}
    </div>
  )
  const cls = cn(
    "block w-full rounded-xl border bg-card px-4 py-3 text-left transition-colors",
    disabled
      ? "cursor-not-allowed opacity-60"
      : "hover:border-primary/40 hover:bg-primary/5"
  )
  if (href && !disabled) return <a href={href} className={cls}>{content}</a>
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {content}
    </button>
  )
}

function SignupForm({ kind, onBack }: { kind: Kind; onBack: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [workspaceName, setWorkspaceName] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState<null | "email" | "google" | "microsoft">(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null)
  const [resent, setResent] = useState<null | "sending" | "sent">(null)

  // OAuth: stash the intent, launch Supabase's redirect. On return the
  // /auth/callback route reads the intent back and trades tokens for cookies.
  const startOAuth = async (provider: "google" | "azure") => {
    setBusy(provider === "azure" ? "microsoft" : "google")
    try {
      sessionStorage.setItem(
        SIGNUP_INTENT_KEY,
        JSON.stringify({ kind, workspaceName: workspaceName.trim() })
      )
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      // The browser redirects; nothing to do here.
    } catch (err) {
      setBusy(null)
      showError(err, "Couldn't start sign-in")
    }
  }

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const trimmed = email.trim()

    // Hard block on known disposable providers — a signup that self-
    // destructs in 10 minutes is a signup that never reaches onboarding.
    if (isDisposableEmail(trimmed)) {
      toast.error("Please use a permanent email address — that provider is disposable.")
      return
    }

    // Soft warn on a likely typo. First submit shows the suggestion; if
    // the user submits again without changing anything we take them at
    // their word and proceed.
    const fix = suggestEmailFix(trimmed)
    if (fix && fix !== emailSuggestion) {
      setEmailSuggestion(fix)
      return
    }

    setBusy("email")
    setEmailSuggestion(null)
    try {
      const res = await apiClient.post<{ message: string; email: string }>(
        "/api/auth/signup",
        { kind, email: trimmed, name: name.trim(), password, workspaceName: workspaceName.trim() }
      )
      setSentTo(res.email)
      toast.success(res.message)
    } catch (err) {
      showError(err, "Couldn't create your account")
    } finally {
      setBusy(null)
    }
  }

  const resendConfirmation = async () => {
    if (!sentTo || resent === "sending") return
    setResent("sending")
    try {
      await apiClient.post("/api/auth/resend-confirmation", { email: sentTo })
      setResent("sent")
      toast.success("Sent — check your inbox again in a minute.")
    } catch (err) {
      setResent(null)
      showError(err, "Couldn't resend the confirmation link")
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card px-6 py-10 text-center">
        <CheckCircleIcon weight="fill" className="size-10 text-primary" />
        <div>
          <p className="text-base font-semibold">Check your email</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{sentTo}</span>. Open
            it on this device to finish setting up.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Didn't arrive? Check spam, or</span>
            <button
              type="button"
              disabled={resent === "sending" || resent === "sent"}
              className="font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-60"
              onClick={() => void resendConfirmation()}
            >
              {resent === "sending" ? "Sending…" : resent === "sent" ? "Resent ✓" : "resend the link"}
            </button>
          </div>
          <button
            type="button"
            className="font-medium text-muted-foreground hover:underline"
            onClick={() => { setSentTo(null); setResent(null) }}
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in with Google or Microsoft, or set a password.
        </p>
      </div>

      <div className="grid gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => void startOAuth("google")}
          disabled={!!busy}
        >
          {busy === "google" ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : (
            <GoogleGlyph className="size-4" />
          )}
          Continue with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => void startOAuth("azure")}
          disabled={!!busy}
        >
          {busy === "microsoft" ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : (
            <MicrosoftGlyph className="size-4" />
          )}
          Continue with Microsoft
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>or use email</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submitEmail} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="su-name">Your name</Label>
          <Input
            id="su-name"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya Iyer"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="su-email">Email</Label>
          <Input
            id="su-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              // Any keystroke clears the suggestion; if the fix still
              // applies on submit it'll surface again.
              if (emailSuggestion) setEmailSuggestion(null)
            }}
            placeholder="you@school.edu"
          />
          {emailSuggestion && (
            <p className="text-xs text-muted-foreground">
              Did you mean{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setEmail(emailSuggestion)
                  setEmailSuggestion(null)
                }}
              >
                {emailSuggestion}
              </button>
              ? Submit again to keep {email.trim()}.
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="su-pw">Password</Label>
          <div className="relative">
            <Input
              id="su-pw"
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="pr-9"
            />
            <button
              type="button"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((s) => !s)}
              className="absolute inset-y-0 right-2 grid place-items-center text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeSlashIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="su-ws">
            School you work at{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="su-ws"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g. St Mary's – 6th Science"
          />
          <p className="text-[11px] text-muted-foreground">
            We use this as the name of your Paperhint workspace. You can rename
            it later.
          </p>
        </div>
        <Button type="submit" size="lg" className="mt-1" disabled={!!busy}>
          {busy === "email" ? (
            <>
              <CircleNotchIcon className="size-4 animate-spin" />
              Sending you a link…
            </>
          ) : (
            "Continue with email"
          )}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          By continuing you agree to our terms and privacy policy.
        </p>
      </form>
    </div>
  )
}

/* ── Provider glyphs, inline so nothing has to load ────────────────────── */

export function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.26 1.06-3.72 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.67 2.84c.86-2.6 3.29-4.51 6.15-4.51Z"/>
    </svg>
  )
}

export function MicrosoftGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path fill="#F25022" d="M2 2h9v9H2z" />
      <path fill="#7FBA00" d="M13 2h9v9h-9z" />
      <path fill="#00A4EF" d="M2 13h9v9H2z" />
      <path fill="#FFB900" d="M13 13h9v9h-9z" />
    </svg>
  )
}

export const SIGNUP_INTENT_STORAGE_KEY = SIGNUP_INTENT_KEY
