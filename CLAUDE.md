# Plinth conventions

Overall design and requirements: GitHub issue #1 (epic) and its sub-issues. Read the issue for the relevant phase before changing things.

## Language
- Everything in the repository and on GitHub is English: code, identifiers, comments, logs, docs, commit messages, issues, PRs, review comments.
- Chinese appears only in what the running app shows its users (UI text, error messages shown in the UI, emails) and in data (sample projects, catalog names, generated room/wall names). Test locators that match that UI text stay Chinese too.
- Text read only by the LLM (system prompt, capability descriptions) is English; the system prompt tells the agent to reply to users in Simplified Chinese.
- Conversation with the project owner is in Chinese.

## UI
- Use shadcn/ui components only (Base UI primitives, Nova style): lists use `Item`, tables `Table`, notices `Alert`, cards `Card`, link-styled actions `Button variant="link"`. Don't hand-write `<button>`, `<table>`, or a bordered `<div>` as a card.
- Theme: shadcn's Vercel theme. The website (`apps/web/src/styles.css`) follows the system light/dark setting.
- The canvas (plan and 3D) renders in a same-origin iframe (`apps/web/src/canvas/CanvasFrame.tsx`) with its own stylesheet (`canvas/canvas.css`). It is light-only and unaffected by the website theme. Light theme variables live in `apps/web/src/theme/light.css`, shared by the website and the canvas.
- Colors only reference theme variables: `var(--background)`, `text-muted-foreground`, `var(--chart-2)`, etc. No hex, `rgb()`/`oklch()`, or Tailwind palette colors (amber, blue…). When three.js needs a concrete color, read it from a theme variable with `apps/web/src/lib/theme.ts` (pass `useCanvasDocument()` inside the canvas).
- Run `npm run check:theme -w @plinth/web` before committing.

## Data and capabilities
- Every mutation goes through the capability registry (`packages/core/src/builtins.ts`) inside a transaction; the UI, the agent and `window.artifact.call` all share it.
- When unsure about a schema field, put it in `extras`; schema changes bump `version` and add a migration in `migrate.ts`.

## Verification
- `npm test` (core contract tests), `npm run typecheck`, `npx tsc --noEmit -p apps/web`
- End to end: see "Testing" in the README.
