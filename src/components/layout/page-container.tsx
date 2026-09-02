/**
 * Horizontal gutters, shared by every page and by the shell's floating
 * controls so the two line up. Kept modest: the widest pages here are data
 * tables, and generous gutters push their right-hand columns off screen. The
 * max-width is a cap for ultrawide displays, not a column.
 */
export const PAGE_GUTTER =
  "mx-auto w-full max-w-[1600px] px-6 md:px-8 lg:px-12 xl:px-16"

/** Vertical space above the title. The shell's controls float inside it. */
export const PAGE_TOP = "pt-6 md:pt-8 lg:pt-10"
