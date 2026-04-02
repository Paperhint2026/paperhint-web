import { PageHeader } from "@/components/common/page-header"

export function HelpPage() {
  return (
    <div className="flex size-full flex-col overflow-y-auto">
      <PageHeader title="Help" />
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Get help and support for PaperHint.
        </p>
      </div>
    </div>
  )
}
