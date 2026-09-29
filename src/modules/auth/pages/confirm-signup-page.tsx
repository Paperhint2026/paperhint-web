import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react"

import { apiClient } from "@/lib/api-client"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { useAppDispatch } from "@/store"
import { hydrateUser, type User } from "@/store/auth-slice"

/**
 * `/confirm` — the landing route for the email confirmation link. Supabase
 * writes the freshly-verified session to the URL fragment; we hand the
 * access + refresh tokens to /auth/confirm-signup, which provisions the
 * workspace (idempotent on repeat clicks) and sets HttpOnly cookies.
 */
export function ConfirmSignupPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const ran = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    ;(async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        if (!code) {
          throw new Error(
            "This confirmation link is expired or already used. Sign up again to get a new link."
          )
        }
        const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exErr) throw exErr
        const session = data?.session
        if (!session?.access_token || !session?.refresh_token) {
          throw new Error(
            "This confirmation link is expired or already used. Sign up again to get a new link."
          )
        }

        const res = await apiClient.post<{
          onboarding_required: boolean
          user: User
        }>("/api/auth/confirm-signup", {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })

        // Purge supabase-js's stored session by deleting its localStorage
        // keys directly. Never supabase.auth.signOut() here — even with
        // scope "local" it still calls GoTrue's /logout and REVOKES the
        // current session server-side, killing the very tokens we just put
        // in the HttpOnly cookies (next authed call: "Invalid token" → 401
        // → bounced to /login). "local" means "this session, not all
        // devices", not "client-side only".
        try {
          for (const k of Object.keys(localStorage)) {
            if (k.startsWith("sb-")) localStorage.removeItem(k)
          }
        } catch {
          /* storage unavailable — nothing was persisted anyway */
        }

        // Populate Redux + localStorage before we navigate. The next page
        // load reads the seeded localStorage on init, which is why we use a
        // full location.replace below rather than react-router navigate:
        // it sidesteps any race between the dispatch commit and the route
        // transition, and ensures no in-flight fetch survives to 401.
        dispatch(hydrateUser(res.user))

        window.location.replace(res.onboarding_required ? "/onboarding" : "/")
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, [dispatch])

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {error ? (
        <>
          <WarningCircleIcon className="size-10 text-destructive/80" />
          <div>
            <p className="text-base font-semibold">We couldn't confirm your account</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => navigate("/signup", { replace: true })}>
            Start over
          </Button>
        </>
      ) : (
        <>
          <CircleNotchIcon className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Confirming your account…</p>
        </>
      )}
    </div>
  )
}
