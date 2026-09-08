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
function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="script-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'none'; form-action 'self'" />`
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
