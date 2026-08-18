# School LMS — Conventions

Coding standards for this repo. The goal is that any contributor — human or AI — produces code indistinguishable in style from what's already here.

## Folder Structure

```
src/
  app/
    (auth)/            # login, register — public routes
    (dashboard)/
      admin/           # admin-only pages
      teacher/         # teacher-only pages
    api/
      <resource>/      # route handlers, grouped by resource (e.g. api/attendance/)
  components/
    ui/                # generic reusable components (Button, Card, Table, Skeleton)
    <feature>/         # feature-specific components (e.g. components/attendance/)
  lib/
    prisma.ts          # Prisma client singleton
    auth.ts            # NextAuth config
    rbac.ts            # role-check helpers
prisma/
  schema.prisma
  migrations/
```

> **Note:** Two login roles only (Admin, Teacher) per SRS v4. Students are data records, not logins — no `/student` or `/parent` route groups.

## Naming

- Files: `kebab-case.tsx` for components, `camelCase.ts` for utilities
- Components: `PascalCase`
- Prisma models: `PascalCase` singular (e.g. `Student`, not `students`)
- Database columns: `camelCase` (Prisma default mapping)
- API routes: plural, resource-based (`/api/students`, `/api/attendance`, not `/api/getStudents`)

## API Route Conventions

- REST-shaped, one resource per folder under `app/api/`.
- Standard HTTP verbs: `GET` (list/read), `POST` (create), `PATCH` (update), `DELETE` (remove).
- Every route handler checks session + role before touching the database — use a shared `requireRole()` helper from `lib/rbac.ts`, don't inline auth checks per route.
- Response shape, success:
  ```json
  { "data": { ... } }
  ```
- Response shape, error:
  ```json
  { "error": { "message": "Plain description of what went wrong", "code": "OPTIONAL_ERROR_CODE" } }
  ```
- Errors are specific, not generic. `"Attendance already marked for this date"`, not `"Something went wrong"`.
- Document every route in `API.md` when it's added — not optional, not "later."

## Component Conventions

- Server Components by default; add `"use client"` only when the component needs interactivity (state, effects, event handlers).
- Data fetching happens in Server Components or API routes — not client-side `useEffect` fetches unless genuinely needed (e.g. polling).
- Every list/table view has a corresponding skeleton component matching its layout shape (per `DESIGN.md`).
- Every empty state is explicit — no component silently renders nothing when data is empty.

## Styling

- Tailwind only — no separate CSS files except globals.
- Tailwind v4 is CSS-first: the design tokens from `DESIGN.md` are mapped in `src/app/globals.css` via `@theme` (e.g. `--color-primary` → `bg-primary`). There is no `tailwind.config.ts` — do not add one.
- No arbitrary hex values or magic numbers in `className` — everything comes from the tokens in `globals.css`.
- No inline `style={}` unless truly dynamic (e.g. a computed width).

## Tooling

- Package manager: **bun** (single lockfile: `bun.lock`). Install with `bun install`, run scripts with `bun run <script>` (e.g. `bun run dev`, `bun run typecheck`).
- No lint or test framework has been chosen yet — do not add one without a documented decision.

## Forms

- Validate on both client (immediate feedback) and server (source of truth) — never trust client validation alone.
- Use a schema validation library (e.g. Zod) shared between client and API route so validation logic isn't duplicated by hand.

## Git

- Branch naming: `feature/<short-description>`, `fix/<short-description>`
- Commit messages: imperative mood, present tense — `"Add attendance marking route"`, not `"Added"` or `"Adding"`
- One logical change per commit where reasonable

## Testing (baseline expectation)

- API routes: at minimum, test RBAC enforcement (wrong role → 403) and core happy path
- Add test coverage expectations here once a testing framework is chosen (not yet decided)

## What Not To Do

- Don't introduce a second icon library, a second font, or a second component styling approach (e.g. CSS modules) — everything routes through Tailwind + Lucide per `DESIGN.md`.
- Don't introduce a second lockfile or switch package managers — bun is the established package manager.
- Don't add new npm dependencies for something a few lines of code can do, especially for free-tier-sensitive concerns (bundle size, cold start).
- Don't bypass Prisma with raw SQL unless there's a documented performance reason (note it inline if you do).
