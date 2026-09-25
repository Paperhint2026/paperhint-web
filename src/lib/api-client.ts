const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
}

/**
 * The session lives in HttpOnly cookies (ph_at, ph_rt) since 2026-09-22 —
 * JS on the page can't read them, so XSS can't lift a 12-hour token. Every
 * fetch here goes with `credentials: "include"` so the browser attaches
 * those cookies on cross-origin calls to api.paperhint.com.
 *
 * A 401 on the FIRST try means the access token expired; we try one silent
 * `POST /auth/refresh` and replay the original request. If that also 401s,
 * the session is truly dead → log out and redirect.
 */

let refreshInFlight: Promise<boolean> | null = null

// The `ph_uid` cookie is the non-HttpOnly companion the server sets on
// login — its presence is the only signal JS has that a session exists at
// all. If it isn't there, there's nothing to refresh; skipping the round
// trip keeps a not-logged-in page from burning through the refresh rate
// limit (or the login one, when they used to share a budget).
function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false
  return /(?:^|;\s*)ph_uid=/.test(document.cookie)
}

async function tryRefresh(): Promise<boolean> {
  if (!hasSessionHint()) return false
  // Coalesce parallel 401s onto a single refresh call — a page that fires
  // ten requests simultaneously must not fire ten refreshes.
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        })
        return res.ok
      } catch {
        return false
      } finally {
        // The Promise resolves; clear the slot so the next 401 can retry
        // fresh instead of getting a stale cached result.
        setTimeout(() => {
          refreshInFlight = null
        }, 0)
      }
    })()
  }
  return refreshInFlight
}

function doFetch(endpoint: string, options: RequestOptions) {
  const { body, headers: customHeaders, ...rest } = options
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData

  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...customHeaders,
  }

  return fetch(`${BASE_URL}${endpoint}`, {
    ...rest,
    // Send HttpOnly session cookies on cross-origin calls; the server's
    // CORS config allows credentials.
    credentials: "include",
    headers,
    body:
      body == null
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  })
}

/** The authed core every request shares: fetch with cookies, one silent
 *  refresh-and-replay on 401, logout+redirect when the session is truly dead.
 *  Returns the raw Response (non-401 errors are the caller's to interpret). */
async function authedFetch(
  endpoint: string,
  options: RequestOptions = {}
): Promise<Response> {
  let response = await doFetch(endpoint, options)

  // Silent refresh, once. Never on the refresh endpoint itself (that would
  // loop) or the login endpoint (a login 401 IS the answer — bad password).
  if (
    response.status === 401 &&
    !endpoint.startsWith("/api/auth/refresh") &&
    !endpoint.startsWith("/api/auth/login")
  ) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      response = await doFetch(endpoint, options)
    }
  }

  if (response.status === 401) {
    const { store } = await import("@/store")
    const { logout } = await import("@/store/auth-slice")
    store.dispatch(logout())
    // Remember where the session died so login can put the user back there
    // (a teacher kicked mid-roll should land back on the roll, not Home).
    try {
      const here = window.location.pathname + window.location.search
      if (here !== "/login") sessionStorage.setItem("post_login_redirect", here)
    } catch {
      /* storage unavailable — plain login flow */
    }
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  return response
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await authedFetch(endpoint, options)

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const err = new Error(
      error.message || error.error || `Request failed: ${response.status}`
    ) as Error & {
      status?: number
      field?: string
      request_id?: string | null
      data?: Record<string, unknown>
    }
    err.status = response.status
    if (typeof error.field === "string") err.field = error.field
    // The server sanitizes 5xx bodies to a generic message + request_id
    // (server-side error hygiene); the request_id is the thread support
    // uses to grep the actual error out of the log. Fall back to the
    // x-request-id header if the body was empty (a proxy timeout, an
    // upstream 502) so every failure still surfaces one.
    err.request_id =
      (typeof error.request_id === "string" ? error.request_id : null) ??
      response.headers.get("x-request-id")
    err.data = error
    throw err
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  get<T>(endpoint: string, options?: RequestOptions) {
    return request<T>(endpoint, { ...options, method: "GET" })
  },
  post<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return request<T>(endpoint, { ...options, method: "POST", body })
  },
  put<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return request<T>(endpoint, { ...options, method: "PUT", body })
  },
  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions) {
    return request<T>(endpoint, { ...options, method: "PATCH", body })
  },
  delete<T>(endpoint: string, options?: RequestOptions) {
    return request<T>(endpoint, { ...options, method: "DELETE" })
  },
  /** Same cookie auth + silent refresh, but hands back the raw Response —
   *  for streaming (SSE reads), blobs, and callers that interpret status
   *  codes themselves (e.g. the timetable's 409 conflict payload). */
  raw(endpoint: string, options?: RequestOptions) {
    return authedFetch(endpoint, options ?? {})
  },
}
