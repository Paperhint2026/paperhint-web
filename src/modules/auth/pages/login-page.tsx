import { useState, type FormEvent } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { Loader2Icon } from "lucide-react"

import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await login({ email, password })
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-8 shadow-lg">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            P
          </div>
          <h1 className="text-xl font-semibold">Welcome to PaperHint</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2Icon className="animate-spin" />}
            Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}
