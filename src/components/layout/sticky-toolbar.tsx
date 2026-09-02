import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/** Nearest ancestor that scrolls vertically — the shell's content area. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === "auto" || overflowY === "scroll") return node
    node = node.parentElement
  }
  return null
}

/**
 * A page toolbar that pins to the top of the shell's scroll area. It bleeds
 * past PAGE_GUTTER so the pinned bar runs edge to edge, and only paints its
 * background and hairline once it is actually stuck — while it sits in flow
 * it is invisible chrome.
 *
 * The gutter classes mirror PAGE_GUTTER in page-container.tsx; change both.
 */
export function StickyToolbar({
  className,
  children,
}: {
  className?: string
  /** Pass a function to render differently while pinned. */
  children: React.ReactNode | ((stuck: boolean) => React.ReactNode)
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    // Shrink the root by 1px at the top: the moment the bar is pinned its top
    // edge sits in that clipped pixel, so it stops being fully visible.
    const io = new IntersectionObserver(
      ([entry]) =>
        setStuck(
          entry.intersectionRatio < 1 &&
            entry.boundingClientRect.top <= (entry.rootBounds?.top ?? 0) + 1
        ),
      { root: scrollParent(el), rootMargin: "-1px 0px 0px 0px", threshold: 1 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={barRef}
      data-stuck={stuck || undefined}
      className={cn(
        "sticky top-0 z-20 -mx-6 -my-2.5 border-b border-transparent px-6 py-2.5 transition-[background-color,box-shadow,border-color] duration-200 md:-mx-8 md:px-8 lg:-mx-12 lg:px-12 xl:-mx-16 xl:px-16",
        stuck &&
          "border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        className
      )}
    >
      {typeof children === "function" ? children(stuck) : children}
    </div>
  )
}
