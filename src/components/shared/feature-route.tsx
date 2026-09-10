import type { ReactNode } from "react"

import { useFeatures, type FeatureKey } from "@/hooks/use-features"
import { Sticker } from "@/components/shared/sticker"
import { PAGE_GUTTER, PAGE_TOP } from "@/components/layout/page-container"
import { cn } from "@/lib/utils"

/**
 * Route wrapper for license-gated modules. If the school's plan disables the
 * feature, deep links land on a friendly explainer instead of a page full of
 * 403s. The API enforces the license regardless.
 */
export function FeatureRoute({
  feature,
  children,
}: {
  feature: FeatureKey
  children: ReactNode
}) {
  const { isEnabled } = useFeatures()

  if (isEnabled(feature)) return <>{children}</>

  return (
    <div
      className={cn(
        PAGE_GUTTER,
        PAGE_TOP,
        "flex min-h-full flex-col items-center justify-center gap-4 pb-12"
      )}
    >
      <Sticker name="peek" size={96} />
      <div className="flex max-w-[360px] flex-col items-center gap-1 text-center">
        <p className="text-base font-medium text-secondary-foreground">
          Not part of your school's plan
        </p>
        <p className="text-sm text-muted-foreground">
          This module isn't enabled for your school. Reach out to PaperHint to
          add it to your plan.
        </p>
      </div>
    </div>
  )
}
