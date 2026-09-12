import { useEffect, useState } from "react"

import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"

/**
 * The school's module licenses (timetable / calendar / copilot / grading).
 * Frontend gating only — the API's requireFeature middleware is the real
 * gate; this hides navigation and shows the "not in your plan" screen.
 *
 * Semantics mirror the server: unknown key = enabled, so a new module is
 * never hidden by omission. While loading we assume enabled to avoid nav
 * flicker for the overwhelmingly common all-enabled case.
 */
export type FeatureKey = "timetable" | "calendar" | "copilot" | "grading"

let cached: Record<string, boolean> | null = null
let inflight: Promise<Record<string, boolean>> | null = null

async function fetchFeatures(): Promise<Record<string, boolean>> {
  if (cached) return cached
  if (!inflight) {
    inflight = apiClient
      .get<{ features: Record<string, boolean> }>("/api/auth/features")
      .then((res) => {
        cached = res.features ?? {}
        return cached
      })
      .catch(() => ({}) as Record<string, boolean>)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Drop the cache on logout/login so the next session refetches. */
export function resetFeaturesCache() {
  cached = null
}

export function useFeatures() {
  const { user } = useAuth()
  const [features, setFeatures] = useState<Record<string, boolean> | null>(cached)

  useEffect(() => {
    if (!user || cached) return
    let alive = true
    fetchFeatures().then((f) => {
      if (alive) setFeatures(f)
    })
    return () => {
      alive = false
    }
  }, [user])

  const isEnabled = (key: FeatureKey) =>
    features === null ? true : features[key] !== false

  return { features, isEnabled, isLoaded: features !== null }
}
