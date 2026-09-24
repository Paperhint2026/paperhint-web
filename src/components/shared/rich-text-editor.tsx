import { useRef } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TableKit } from "@tiptap/extension-table"
import { ResizableImage } from "@/components/shared/resizable-image"
import { Markdown } from "tiptap-markdown"
import {
  ImageSquareIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  TextBIcon,
  TextHTwoIcon,
  TextItalicIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * General-purpose WYSIWYG editor that speaks markdown out the back — the
 * circular composer's body, and anywhere else a teacher or admin writes
 * more than a line. The person sees a document (headings, bold, lists);
 * `onChange` receives markdown, which is what the API stores and renders.
 * Markdown typing shortcuts (## , ** , - ) work as they do in Notes.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeightClass = "min-h-[220px]",
  className,
  onPickImage,
}: {
  /** Initial markdown. The editor owns the document after mount. */
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  minHeightClass?: string
  className?: string
  /**
   * Enables the insert-image toolbar button. Called with the picked file;
   * return the src to place in the document (e.g. an object URL the caller
   * tracks and later swaps for a real reference), or null to reject it.
   */
  onPickImage?: (file: File) => string | null
}) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const editor = useEditor({
    extensions: [
      StarterKit,
      TableKit,
      ResizableImage,
      Markdown.configure({ html: false, linkify: true, breaks: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          minHeightClass,
          "px-3 py-2.5 text-sm leading-relaxed text-foreground focus:outline-none",
          "[&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold",
          "[&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold",
          "[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
          "[&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5",
          "[&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic",
          "[&_table]:w-full [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border-t [&_td]:px-2 [&_td]:py-1"
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      const storage = ed.storage as unknown as {
        markdown: { getMarkdown: () => string }
      }
      onChange(storage.markdown.getMarkdown())
    },
  })

  if (!editor) return null

  const tools = [
    { label: "Heading", icon: TextHTwoIcon, active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Bold", icon: TextBIcon, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italic", icon: TextItalicIcon, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Bullet list", icon: ListBulletsIcon, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Numbered list", icon: ListNumbersIcon, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
  ]

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-background", className)}>
      <div className="flex items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
        {tools.map((t) => (
          <Button
            key={t.label}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.label}
            className={cn(t.active && "bg-muted text-foreground")}
            onClick={t.run}
          >
            <t.icon className="size-4" />
          </Button>
        ))}
        {onPickImage && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Insert image into the message"
              title="Insert image"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImageSquareIcon className="size-4" />
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (!file) return
                const src = onPickImage(file)
                if (src) {
                  editor.chain().focus().setImage({ src, alt: file.name }).run()
                }
              }}
            />
          </>
        )}
      </div>
      <div className="relative" onClick={() => editor.commands.focus()}>
        {placeholder && editor.isEmpty && (
          <p className="pointer-events-none absolute top-2.5 left-3 text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
