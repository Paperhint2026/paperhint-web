import { useCallback, useEffect, useState } from "react"

/**
 * The pattern almost every page uses — fetch, hold data or error, offer a
 * reload — as one hook, so the three states (loading, loaded, failed) become
 * mutually exclusive instead of a silent `.catch(() => setItems([]))` that
 * looks like "nothing yet" whether the API is empty OR broken.
 *
 * Callers get:
 *   { data, error, loading, reload }
 *
 * `fetcher` is captured on first render (deps stabilize it) so the identity
 * doesn't churn the effect on every render. `reload()` retries in place.
 */
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[]
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher()
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload: load }
}
