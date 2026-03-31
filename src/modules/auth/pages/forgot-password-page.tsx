import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { ArrowLeftIcon, Loader2Icon, MailIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(data.error || "Something went wrong")
      }

      setIsSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSent) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-background p-8 shadow-lg">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <MailIcon className="size-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Check Your Email</h1>
            <p className="text-sm text-muted-foreground">
              We've sent a password reset link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Please check your inbox and click the link to reset your password.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <div className="flex w-full flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsSent(false)
                  setEmail("")
                }}
              >
                Try another email
              </Button>
              <Link to="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeftIcon className="size-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
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
          <h1 className="text-xl font-semibold">Forgot Password?</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
            Send Reset Link
          </Button>

          <Link to="/login" className="mx-auto">
            <Button variant="ghost" size="sm" type="button">
              <ArrowLeftIcon className="size-4" />
              Back to Login
            </Button>
          </Link>
        </form>
      </div>
    </div>
  )
}
