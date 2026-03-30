import { PageHeader } from "@/components/common/page-header"

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Configure your application settings.
        </p>
      </div>
    </>
  )
}
