import { useMemo } from "react"
import type { Components } from "react-markdown"

import { cn } from "@/lib/utils"
import { Markdown } from "@/components/ui/markdown"

/**
 * Teaching notes are a lesson script the teacher glances at mid-class, so
 * the hierarchy has to be visible at a glance: sections (##) read as
 * chapter heads, time blocks (###) as pills, board text stands out. The
 * page's `prose` class is not wired to the typography plugin, so these
 * styles live here explicitly.
 */
const COMPONENTS: Partial<Components> = {
  h1: ({ children }) => (
    <h1 className="mb-3 text-lg font-semibold tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2 border-t pt-4 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-1.5 inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[13px] font-semibold text-primary">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-semibold">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-2.5 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2.5 list-disc space-y-1 pl-5 text-sm leading-relaxed">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2.5 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="[&>p]:mb-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  img: ({ src, alt }) => {
    // Inline images can carry a size marker in the alt — `![alt|w=50](src)` —
    // written by the editor's Small/Medium/Full presets.
    const m = (alt ?? "").match(/^(.*?)\|w=(\d{1,3})$/)
    const width = m ? Math.min(100, Math.max(10, Number(m[2]))) : 100
    return (
      <img
        src={typeof src === "string" ? src : undefined}
        alt={m ? m[1] : (alt ?? "")}
        loading="lazy"
        style={width < 100 ? { width: `${width}%` } : undefined}
        className="my-3 max-h-[28rem] max-w-full rounded-lg border object-contain"
      />
    )
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border">
      <table className="w-full text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="bg-muted/50 px-3 py-2 text-left text-xs font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-t px-3 py-2 align-top">{children}</td>
  ),
  code: ({ children, className }) => (
    <code
      className={cn(
        "rounded-sm bg-muted px-1 py-0.5 font-mono text-[12px]",
        className
      )}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2.5 overflow-x-auto rounded-lg bg-muted p-3 text-[12px]">
      {children}
    </pre>
  ),
}

export function NotesMarkdown({
  content,
  hideTitle = false,
  className,
}: {
  content: string
  /** The card header already shows the title — drop the leading "# " line. */
  hideTitle?: boolean
  className?: string
}) {
  const body = useMemo(() => {
    if (!hideTitle) return content
    return content.replace(/^\s*#\s+[^\n]+\n+/, "")
  }, [content, hideTitle])

  return (
    <Markdown className={cn("text-foreground", className)} components={COMPONENTS}>
      {body}
    </Markdown>
  )
}
