import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { ExamIcon, PaperclipIcon, TranslateIcon } from "@phosphor-icons/react"

import { NotesMarkdown } from "@/modules/notes/components/notes-markdown"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  mr: "मराठी",
  bn: "বাংলা",
  gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ",
  or: "ଓଡ଼ିଆ",
  as: "অসমীয়া",
  ur: "اردو",
}

interface PublicCircular {
  school_name: string | null
  subject: string
  body_md: string
  language: string
  is_translation: boolean
  languages: string[]
  attachments: {
    name: string
    size: number
    inline?: boolean
    url?: string | null
    download_url?: string | null
  }[]
  sent_at: string
}

/**
 * The tokenized, no-login circular page parents land on from a WhatsApp
 * message or a forwarded link (/c/:token). Deliberately bare: the school's
 * name, the message, attachments — no navigation into the app. The language
 * dropdown serves only translations already cached server-side.
 */
export function PublicCircularPage() {
  const { token } = useParams<{ token: string }>()
  const [params, setParams] = useSearchParams()
  const lang = params.get("lang") || "en"
  const [data, setData] = useState<PublicCircular | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "missing" | "error">("loading")

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setStatus("loading")
    fetch(`${BASE_URL}/api/public/circulars/${token}?lang=${encodeURIComponent(lang)}`)
      .then(async (r) => {
        if (cancelled) return
        if (r.status === 404) return setStatus("missing")
        if (!r.ok) return setStatus("error")
        setData(await r.json())
        setStatus("ok")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [token, lang])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
        <div className="flex items-center gap-2">
          <ExamIcon className="size-5 text-primary" weight="fill" />
          <span className="text-base font-semibold">
            Paper<span className="text-primary">hint</span>
          </span>
        </div>

        {status === "loading" && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        )}

        {(status === "missing" || status === "error") && (
          <div className="rounded-xl border bg-card px-5 py-10 text-center">
            <p className="text-base font-medium">
              {status === "missing"
                ? "This circular is no longer available."
                : "Something went wrong — try again in a moment."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status === "missing"
                ? "The link may have been revoked by the school."
                : ""}
            </p>
          </div>
        )}

        {status === "ok" && data && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {data.school_name && (
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {data.school_name}
                  </p>
                )}
                <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
                  {data.subject}
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(data.sent_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              {data.languages.length > 1 && (
                <Select
                  value={data.language}
                  onValueChange={(v) => {
                    const next = new URLSearchParams(params)
                    if (v === "en") next.delete("lang")
                    else next.set("lang", v)
                    setParams(next, { replace: true })
                  }}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <TranslateIcon className="size-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.languages.map((l) => (
                      <SelectItem key={l} value={l}>
                        {LANGUAGE_LABELS[l] ?? l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {data.is_translation && (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                Machine translated · the English original is authoritative.
                Attachments are not translated.
              </p>
            )}

            <div className="rounded-xl border bg-card px-4 py-4 sm:px-5">
              <NotesMarkdown content={data.body_md} />
            </div>

            {data.attachments.filter((a) => !a.inline).length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Attachments
                </p>
                <ul className="flex flex-col divide-y rounded-xl border bg-card">
                  {data.attachments
                    .filter((a) => !a.inline)
                    .map((a) => (
                      <li key={a.name}>
                        <a
                          href={a.download_url ?? a.url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/40"
                        >
                          <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{a.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {(a.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </a>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <p className="pb-4 text-center text-[11px] text-muted-foreground">
              Sent via Paperhint
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
