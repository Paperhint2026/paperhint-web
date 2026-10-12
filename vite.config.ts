import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// Production-only CSP meta tag. Second line of defense behind
// rehype-sanitize on markdown surfaces: even if HTML slipped through, no
// inline/external script may run and no plugin/frame may load. Build-only
// because the dev server needs Vite's inline react-refresh preamble.
// script-src is the teeth; styles/images/connect stay open (KaTeX injects
// styles, answer sheets load from signed Supabase URLs).
//
// frame-src 'none' means NO <iframe>/<object> PDF previews — they render blank
// in prod. PDFs are drawn to canvases by components/shared/pdf-pages.tsx
// (pdf.js, bundled locally so its worker passes script-src 'self').
//
// 'wasm-unsafe-eval' is NOT 'unsafe-eval': JS eval()/new Function stay
// blocked; it only permits WebAssembly compilation. @react-pdf/renderer's
// Yoga layout engine is wasm — without it the question-paper PDF builder
// dies in prod with a CSP CompileError.
function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'self'; frame-src 'none'; form-action 'self'" />`
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cspMeta()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
