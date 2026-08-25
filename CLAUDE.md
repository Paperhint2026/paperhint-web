# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server at `http://localhost:5173`.
- `npm run build` — runs `tsc -b` then `vite build`. The TS step is part of the build, so type errors fail the build.
- `npm run typecheck` — `tsc --noEmit`. Run this before committing significant TS changes.
- `npm run lint` — ESLint over the repo (flat config in [eslint.config.js](eslint.config.js): `js.recommended` + `typescript-eslint.recommended` + `react-hooks` + `react-refresh`).
- `npm run format` — Prettier with `prettier-plugin-tailwindcss`. Settings: no semicolons, double quotes, 2-space indent, `lf` line endings. The plugin sorts Tailwind class lists in `cn(...)` and `cva(...)` calls — don't fight its ordering.
- `npm run preview` — serve the production `dist/` build.
- No test runner is configured. Don't invent one.

Node 20 (`.nvmrc`). `.npmrc` pins `save-exact=true` — when adding dependencies, expect exact versions in `package.json`, not ranges.

This client talks to the backend at `VITE_API_BASE_URL` (`.env.development` → `http://localhost:3000`, `.env.production` → `https://api.paperhint.com`). The backend lives at `../paperhint-service` (registered as an additional working directory). When changing API contracts, update both sides.

## shadcn/ui

[components.json](components.json) configures shadcn with `style: radix-maia` and `baseColor: mist`. Add components via `npx shadcn@latest add <name>` — they land in [src/components/ui/](src/components/ui/). A shadcn MCP server is wired up in both [.mcp.json](.mcp.json) and [.cursor/mcp.json](.cursor/mcp.json) (`npx shadcn@latest mcp`); when a `shadcn` skill is available it is preferable to use it for component work.

Aliases (mirrored in [tsconfig.app.json](tsconfig.app.json) and [vite.config.ts](vite.config.ts)): `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`. Import paths should use `@/...`, not relative chains.

Styling lives in [src/index.css](src/index.css) — Tailwind v4 with `@import "tailwindcss"`, `tw-animate-css`, `shadcn/tailwind.css`, and the Geist variable font. There is no `tailwind.config.js`; theme tokens are declared inline via `@theme inline` and CSS variables. Use the existing tokens (`bg-background`, `text-muted-foreground`, etc.) rather than hard-coded colors.

## Architecture

### Entry & routing

[src/main.tsx](src/main.tsx) wires up `Provider` (Redux), `ThemeProvider` (next-themes), `RouterProvider`, and a `Toaster`. It also intercepts Supabase auth callback hashes (`type=invite` / `type=magiclink`) on **any** URL and redirects to `/set-password` — needed because the backend sends invite emails that link to the site root.

All routes are declared in [src/routes/index.tsx](src/routes/index.tsx) using `createBrowserRouter`. The shape:

```
/login, /forgot-password, /reset-password, /set-password   (public)
<ProtectedRoute>                                           (token gate)
  <AppLayout>                                              (sidebar + dynamic header)
    /, /classes, /teachers, /students, /library, /ask, /settings, /help
    /classes/:grade/overview
    /class/:classSubjectId/{knowledge,exams,grading,students,...}
```

Two parameterized scopes drive most of the header behavior:
- `:grade` → grade-level overview pages.
- `:classSubjectId` → class-subject scoped pages (knowledge / exams / grading / students). [AppLayout](src/components/layout/app-layout.tsx) renders a `ToggleGroup` whose value it derives from the pathname (e.g. `/class/:csId/exams/:examId/questions` keeps the "Exams" tab highlighted). When adding a new class-subject sub-page, update the `classSubTab` derivation logic — there is no auto-detection.

### Module layout

```
src/modules/<feature>/
  pages/              # route components — referenced by src/routes/index.tsx
  components/         # feature-scoped components (NOT in src/components)
  lib/                # feature-scoped types/helpers (e.g. knowledge/lib/types.ts)
```

`src/components/` is reserved for cross-feature shells: `layout/`, `ui/` (shadcn), `shared/`, plus the sidebar nav fragments (`nav-*.tsx`). Don't put feature-specific code in `src/components` — keep it under its `modules/<feature>/components/` folder.

### State

[src/store/index.ts](src/store/index.ts) configures Redux Toolkit with three slices: `auth`, `school`, `subjects`. Use the typed hooks `useAppDispatch` / `useAppSelector` exported from `@/store` rather than the bare `react-redux` ones.

State persistence is **manual via `localStorage`** (not redux-persist). Each slice that persists writes its own keys in its reducers (see [auth-slice.ts](src/store/auth-slice.ts) `logout` clearing `access_token`, `user`, `school`, `subjects`). When adding a new persisted slice, follow the same pattern and remember to clear it on logout.

For scoped/derived UI state, use module-local hooks. The repo also has lightweight in-memory module caches (e.g. `cachedAssignments` in [use-teacher-assignments.ts](src/hooks/use-teacher-assignments.ts)) — keyed by user id and invalidated implicitly on user change. Match this pattern before reaching for a new Redux slice.

### API client & auth flow

All HTTP goes through [src/lib/api-client.ts](src/lib/api-client.ts). It auto-attaches `Authorization: Bearer <localStorage.access_token>` and handles 401s globally: it dynamically imports the store, dispatches `logout`, and redirects to `/login`. Don't replicate that logic in callers — let a 401 bubble.

Auth UX is centralized in [src/lib/auth.tsx](src/lib/auth.tsx) (`useAuth()` hook). On successful login it dispatches the login thunk **and** `fetchSchool()` so the school context is hydrated by the time the layout renders. On logout it clears auth and school slices.

`ProtectedRoute` only gates on the presence of a token (`!!token`). The token is validated on first authenticated request — if it's stale, the api-client catches the 401 and bounces the user.

### Header action slot

[HeaderActionsContext](src/components/layout/header-actions-context.tsx) lets a page inject its own CTA into the app shell header. Pages call `useHeaderActions().setHeaderActions(<Button>…</Button>)` from an effect; the layout renders whatever is set. This is the standard way to add page-specific action buttons (e.g. "New exam"). Reset to `null` on cleanup.

### Class-scoped AI chat sheet

When `:classSubjectId` is present and the user is a teacher, [AppLayout](src/components/layout/app-layout.tsx) shows an "Ask AI" button that opens [ClassAiChatSheet](src/components/class-ai-chat/class-ai-chat-sheet.tsx). This is class-scoped chat — distinct from the global `/ask` Copilot page (`CopilotPage`). Both ultimately call the backend `/api/copilot/...` endpoints.

### Routing & deployment

[vercel.json](vercel.json) rewrites every path to `/` so React Router handles deep links on Vercel. SPA-only — there is no SSR.

## Conventions

- TS strict mode is on, including `noUnusedLocals` / `noUnusedParameters`. Prefix intentional unused params with `_` rather than disabling lint rules.
- `verbatimModuleSyntax` is enabled — use `import type` for type-only imports or the build will fail.
- File naming: `kebab-case.tsx` for components, `kebab-case.ts` for hooks/utils. Page components live as `<feature>-page.tsx` and export the component named-export style (`export function FooPage()`), not default exports.
- Use `cn()` from [@/lib/utils](src/lib/utils.ts) for conditional class composition — don't call `clsx` / `twMerge` directly.
- Toasts use `sonner` (`import { toast } from "sonner"`). The `<Toaster />` is mounted once in `main.tsx` with `richColors` and `top-right` — don't add another.
- Use `dayjs` for date formatting (already a dependency); `date-fns` is also installed but reserved for `react-day-picker` internals — don't mix the two without a reason.
- Markdown rendering uses `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-raw`. KaTeX CSS must be imported (`import "katex/dist/katex.min.css"`) wherever math is rendered.
