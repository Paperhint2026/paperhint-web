import { defaultSchema } from "rehype-sanitize"

/**
 * Sanitize schema for every ReactMarkdown surface that renders UNTRUSTED
 * content — AI answers, OCR'd question text, exams cloned from the public
 * bank. rehype-raw parses any embedded HTML into real elements, so without
 * this a crafted question could inject scripts/handlers and lift the JWT
 * from localStorage (cross-tenant via public-exam cloning).
 *
 * Plugin order at every call site must be:
 *   rehypeRaw → [rehypeSanitize, sanitizeSchema] → rehypeKatex
 * Sanitizing BEFORE KaTeX means KaTeX's own generated spans (classes,
 * inline styles) are never stripped, while the math SOURCE text passes
 * through sanitization like any other text.
 */
export const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // remark-math marks math nodes with these classes; rehype-katex (which
    // runs after sanitize) needs them intact to find the math.
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-./, "math-inline", "math-display"],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", "math", "math-inline", "math-display"],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", "math", "math-display"],
    ],
  },
} as typeof defaultSchema
