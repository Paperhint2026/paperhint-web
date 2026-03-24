# Paperhint Web

The web client for Paperhint — an AI-powered answer sheet grading platform for teachers.

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and builds
- **Tailwind CSS v4** for styling
- **shadcn/ui** for pre-built accessible components
- **Lucide React** for icons
- **ESLint** + **Prettier** for code quality

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Linting & Formatting

```bash
npm run lint
npm run format
npm run typecheck
```

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

Components are placed in `src/components/ui/`. Import them using the `@/` alias:

```tsx
import { Button } from "@/components/ui/button"
```

## Project Structure

```
paperhint-web/
├── public/              # Static assets
├── src/
│   ├── assets/          # Images, fonts, etc.
│   ├── components/
│   │   └── ui/          # shadcn/ui components
│   ├── lib/             # Utility functions
│   ├── App.tsx          # Root component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles & Tailwind
├── components.json      # shadcn/ui configuration
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── package.json
```

## License

Private
