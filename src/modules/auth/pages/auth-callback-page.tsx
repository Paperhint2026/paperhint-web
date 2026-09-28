import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { SIGNUP_INTENT_STORAGE_KEY } from "@/modules/auth/pages/signup-page"
import { useAppDispatch } from "@/store"
import { hydrateUser, type User } from "@/store/auth-slice"
import { fetchSchool } from "@/store/school-slice"

/**
 * `/auth/callback` — returned to by Supabase after Google/Microsoft OAuth.
 * We ask supabase-js for the session that was just written to the URL
 * fragment, trade those tokens for our HttpOnly cookies through
 * /auth/oauth-complete, then send the user to /onboarding on first login
 * or the home page for a returning user. Any failure surfaces a real error
 * (not a silent redirect that leaves the user staring at /login).
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  // React 18 dev-mode double-mounts effects; guard so we don't send two
  // POSTs for the same tokens.
  const ran = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    ;(async () => {
      try {
        // Explicitly exchange the URL's `?code=...` for a fresh session.
        // The current URL still carries the code from the OAuth redirect.
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        if (!code) {
          throw new Error("The sign-in didn't complete — please try again.")
        }
        const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exErr) throw exErr
        const session = data?.session
        if (!session?.access_token || !session?.refresh_token) {
          throw new Error("The sign-in didn't complete — please try again.")
        }

        // The signup page stashed the plan intent before redirecting. Read
        // it back (fine to be absent — that means an existing user is just
        // logging in via OAuth, no provisioning needed).
        let kind: "solo" | "coaching" | undefined
        let workspaceName: string | undefined
        try {
          const raw = sessionStorage.getItem(SIGNUP_INTENT_STORAGE_KEY)
          if (raw) {
            const parsed = JSON.parse(raw)
            kind = parsed?.kind
            workspaceName = parsed?.workspaceName || undefined
          }
        } catch {
          /* corrupt intent — treat as absent */
        } finally {
          sessionStorage.removeItem(SIGNUP_INTENT_STORAGE_KEY)
        }

        const res = await apiClient.post<{
          onboarding_required: boolean
          user: User
        }>("/api/auth/oauth-complete", {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          kind,
          workspaceName,
        })

        // Local-only signOut: clears the SDK's localStorage entries so the
        // JS session doesn't linger, WITHOUT hitting Supabase's revoke endpoint —
        // that would kill the very access + refresh tokens we just cookied,
        // and the next authed call would 401 → bounce to /login.
        await supabase.auth.signOut({ scope: "local" }).catch(() => {})

        // Populate Redux so ProtectedRoute sees an authenticated user; the
        // school-slice fetch mirrors what the email/password login flow does.
        dispatch(hydrateUser(res.user))
        dispatch(fetchSchool())

        navigate(res.onboarding_required ? "/onboarding" : "/", { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [navigate, dispatch])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {error ? (
        <>
          <WarningCircleIcon className="size-10 text-destructive/80" />
          <div>
            <p className="text-base font-semibold">Something went wrong</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => navigate("/signup", { replace: true })}>
            Back to sign up
          </Button>
        </>
      ) : (
        <>
          <CircleNotchIcon className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Setting up your account…</p>
        </>
      )}
    </div>
  )
}
