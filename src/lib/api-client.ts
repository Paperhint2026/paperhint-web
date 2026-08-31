const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options

  // FormData carries its own multipart Content-Type with a boundary; forcing
  // application/json here would break file uploads. Let the browser set it.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData

  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...customHeaders,
  }

  const token = localStorage.getItem("access_token")
  if (token) {
    ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers,
    body: body == null
      ? undefined
      : isFormData
        ? (body as FormData)
        : JSON.stringify(body),
    ...rest,
  })

  if (response.status === 401) {
    const { store } = await import("@/store")
    const { logout } = await import("@/store/auth-slice")
    store.dispatch(logout())
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || error.error || `Request failed: ${response.status}`)
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
}
