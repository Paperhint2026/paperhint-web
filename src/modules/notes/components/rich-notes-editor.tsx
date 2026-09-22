import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { TableKit } from "@tiptap/extension-table"
import { Markdown } from "tiptap-markdown"
import {
  CircleNotchIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  TextBIcon,
  TextHTwoIcon,
  TextHThreeIcon,
  TextItalicIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * WYSIWYG editor for teaching notes: the teacher edits the rendered document
 * (headings, bold, lists — no markdown syntax on screen) and we read the
 * result back as markdown, which is what the API stores and the reminder
 * pipeline reads. Markdown typing shortcuts (## , ** , - ) still work.
 */
export function RichNotesEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: string
  onSave: (markdown: string) => void
  onCancel: () => void
  saving: boolean
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TableKit,
      Markdown.configure({
        html: false, // treat embedded HTML as text — notes are pure markdown
        linkify: false,
        breaks: false,
      }),
    ],
    content: initial,
    editorProps: {
      attributes: {
        // Mirrors NotesMarkdown so what you edit looks like what you read.
        class: cn(
          "min-h-[320px] px-1 py-2 text-sm leading-relaxed text-foreground focus:outline-none",
          "[&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:tracking-tight",
          "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:border-t [&_h2]:pt-4 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:tracking-wide [&_h2]:text-muted-foreground [&_h2]:uppercase",
          "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:inline-block [&_h3]:rounded-md [&_h3]:bg-primary/10 [&_h3]:px-2 [&_h3]:py-0.5 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-primary",
          "[&_p]:mb-2.5 [&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1",
          "[&_strong]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:italic",
          "[&_table]:w-full [&_table]:text-[13px] [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border-t [&_td]:px-3 [&_td]:py-2",
          "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px]"
        ),
      },
    },
  })

  if (!editor) return null

  const tools: {
    label: string
    icon: React.ComponentType<{ className?: string }>
    active: boolean
    run: () => void
  }[] = [
    {
      label: "Heading",
      icon: TextHTwoIcon,
      active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Subheading",
      icon: TextHThreeIcon,
      active: editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bold",
      icon: TextBIcon,
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: TextItalicIcon,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Bullet list",
      icon: ListBulletsIcon,
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: ListNumbersIcon,
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ]

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
        {tools.map((t) => (
          <Button
            key={t.label}
            variant="ghost"
            size="icon-sm"
            aria-label={t.label}
            className={cn(t.active && "bg-muted text-foreground")}
            onClick={t.run}
          >
            <t.icon className="size-4" />
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => {
              // tiptap-markdown registers its storage at runtime; the type
              // augmentation isn't shipped, hence the cast.
              const storage = editor.storage as unknown as {
                markdown: { getMarkdown: () => string }
              }
              onSave(storage.markdown.getMarkdown())
            }}
          >
            {saving ? (
              <>
                <CircleNotchIcon className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
      <div className="px-4 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
