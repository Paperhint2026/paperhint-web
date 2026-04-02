import { PageHeader } from "@/components/common/page-header"

export function HomePage() {
  return (
    <div className="flex size-full flex-col overflow-y-auto">
      <PageHeader title="Home" />
      <div className="p-6">
        <h2 className="text-lg font-semibold">Welcome to PaperHint</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select a module from the sidebar to get started.
        </p>
      </div>
    </div>
  )
}
