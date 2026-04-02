import { cn } from "@/lib/utils"
import "katex/dist/katex.min.css"
import { memo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { CodeBlock, CodeBlockCode } from "./code-block"

export type MarkdownProps = {
  children: string
  className?: string
  components?: Partial<Components>
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    )
  },
  pre: ({ children }) => <>{children}</>,
}

function MarkdownComponent({
  children,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export const Markdown = memo(MarkdownComponent)
