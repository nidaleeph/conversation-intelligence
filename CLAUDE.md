# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DDRE War Room (ADVSR Conversation Intelligence) — a real estate conversation intelligence platform that classifies WhatsApp messages in the luxury North London property market into actionable signals (buyer searches, tenant searches, property listings, etc.) and provides agents with a dashboard to manage leads, alerts, and market intelligence.

Currently a frontend-heavy SPA with mock data — no backend API, database, or real ingestion pipeline yet.

## Commands

- **Dev server:** `pnpm dev` (Vite on port 3000)
- **Build:** `pnpm build` (Vite frontend to `dist/public` + esbuild backend to `dist/index.js`)
- **Production:** `pnpm start` (serves built assets via Express)
- **Type check:** `pnpm check` (`tsc --noEmit`)
- **Format:** `pnpm format` (Prettier)
- **Package manager:** pnpm (pinned to 10.4.1 via `packageManager` field)

No test runner is configured yet (vitest is in devDependencies but unused).

## Architecture

### Three-layer monorepo structure

```
client/src/    → React SPA (Vite + React 19 + Tailwind v4 + shadcn/ui)
server/        → Minimal Express static file server (no API routes)
shared/        → Shared constants between client and server
```

### Frontend

- **Router:** wouter (lightweight, not React Router) — routes defined in `client/src/App.tsx`
- **Pages:** Dashboard, Parser, LiveFeed, Agents, AgentProfile (plus stubs for alerts/signals/areas/settings that render Dashboard)
- **Layout:** `DashboardLayout` wraps all pages with sidebar navigation
- **UI components:** 50+ shadcn/ui components in `client/src/components/ui/`, configured via `components.json`
- **State:** React Context (ThemeContext) + local useState/useMemo — no state management library
- **Data:** All mock data and TypeScript interfaces live in `client/src/lib/data.ts` — 12 signal types, RawMessage/Signal/Alert/AgentProfile interfaces
- **Styling:** Tailwind v4 with custom design tokens — bg `#1a1e23`, card `#22272d`, teal `#77d5c0`, gold `#d4a843`, DM Sans typography
- **Charts:** Recharts for data visualization
- **Animations:** Framer Motion

### Path aliases (tsconfig + vite)

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

### Backend

Express serves `dist/public` as static files with a catch-all `GET *` returning `index.html` for SPA routing. No API endpoints exist yet.

### Environment variables

Accessed via `import.meta.env.VITE_*` on the client:
- `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID` — OAuth integration
- `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` — Umami analytics
- `PORT` — server port (default 3000)

## Code Style

- Prettier: double quotes, semicolons, trailing commas (es5), 2-space indent, `printWidth: 80`, arrow parens avoided
- TypeScript strict mode enabled
- PascalCase components, camelCase functions/variables
- No ESLint configured
