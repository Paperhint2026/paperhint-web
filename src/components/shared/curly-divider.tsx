/**
 * A hairline that trails off instead of stopping dead — a beat between a
 * record's own identity and the things it owns (department edit drawer,
 * 2026-09-15; reused for the teacher form). Tiled at a fixed pixel period
 * (`patternUnits="userSpaceOnUse"`, no viewBox scaling) so the wave looks
 * the same at any container width instead of stretching or compressing to
 * fit; the fade is a separate opacity mask, not mixed into the stroke
 * color, so the line itself stays one consistent color.
 */
export function CurlyDivider({ id = "curly-fade" }: { id?: string }) {
  return (
    <svg
      width="100%"
      height="12"
      aria-hidden="true"
      className="my-1 block text-border"
    >
      <defs>
        <pattern
          id={`${id}-wave`}
          width="16"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0,6 Q4,1.5 8,6 T16,6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </pattern>
        <linearGradient id={`${id}-gradient`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect width="100%" height="12" fill={`url(#${id}-gradient)`} />
        </mask>
      </defs>
      <rect
        width="100%"
        height="12"
        fill={`url(#${id}-wave)`}
        mask={`url(#${id}-mask)`}
      />
    </svg>
  )
}
