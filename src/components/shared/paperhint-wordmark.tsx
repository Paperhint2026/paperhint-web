import { cn } from "@/lib/utils"

/**
 * The PaperHint wordmark, matching the marketing site (paperhint-site,
 * `Nav.astro` + `style.css` `.brand`): "Paper" in Geist, then "hint" in the
 * brand green with its `h` set as a Merriweather italic, slightly smaller and
 * tucked flush into the rest of the word.
 *
 * Size is inherited, so the caller sets it — the site uses 21px in its nav.
 */
export function PaperhintWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-sans font-medium tracking-[-0.02em] whitespace-nowrap",
        className
      )}
    >
      Paper
      {/* No word space: the italic h carries its own left sidebearing, which is
          all the separation the lockup needs. `0.5px` after it is the site's
          own value, closing the h back into "int". */}
      <span className="ml-[0.02em] text-primary">
        <em className="mr-[0.5px] font-serif text-[0.94em] font-medium tracking-normal italic">
          h
        </em>
        int
      </span>
    </span>
  )
}
