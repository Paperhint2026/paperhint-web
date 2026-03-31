import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircleIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

function extractTokenFromHash(): string | null {
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  return params.get("access_token")
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    setToken(extractTokenFromHash())
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (!token) {
      setError(
        "Invalid or missing access token. Please use the link from your email.",
      )
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`${BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(data.error || "Failed to reset password")
      }

      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token && !isSuccess) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-background p-8 shadow-lg">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-xl font-bold text-destructive">
              !
            </div>
            <h1 className="text-xl font-semibold">Invalid Link</h1>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired. Please request
              a new one.
            </p>
            <Button variant="outline" onClick={() => navigate("/forgot-password")}>
              Request New Link
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-background p-8 shadow-lg">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircleIcon className="size-12 text-green-500" />
            <h1 className="text-xl font-semibold">Password Reset!</h1>
            <p className="text-sm text-muted-foreground">
              Your password has been reset successfully. You can now sign in with
              your new password.
            </p>
            <Button className="w-full" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            P
          </div>
          <h1 className="text-xl font-semibold">Reset Your Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  )
}
