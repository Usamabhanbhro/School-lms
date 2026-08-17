# AGENTS.md

Instructions for any AI coding tool (Claude Code, Cursor, Copilot, etc.) working in this repository. Read this file first, before making any change.

## Before You Do Anything

1. Read `README.md` for project overview and setup.
2. Read `ARCHITECTURE.md` — do not deviate from the chosen stack (Next.js App Router, Prisma, Neon Postgres, NextAuth, Tailwind, Vercel) without it being an explicit, discussed decision.
3. Read `DESIGN.md` before writing or editing any UI — colors, type, spacing, motion, and component patterns are specified there and are not up for reinterpretation per-component.
4. Read `CONVENTIONS.md` before writing any code — folder structure, naming, API shape, and styling rules are defined there.
5. Check `SCHEMA.md` and `API.md` before adding a new database model or API route — check whether it already exists or is planned, to avoid duplicate/conflicting entities or endpoints.

## Hard Rules

- **Do not introduce a new stack choice** (different framework, different ORM, different DB, different hosting) without flagging it explicitly and getting confirmation. This repo has already been through that decision process — don't re-litigate it silently.
- **Do not deviate from the design tokens** in `DESIGN.md`. No new colors, no new fonts, no rounded corners beyond what's specified, no shadow-heavy UI, no new icon library.
- **Do not skip RBAC checks.** Every API route must verify the session role before touching data. Use `lib/rbac.ts` helpers, don't inline ad hoc checks.
- **Do not hard-delete academic records** (attendance, grades) without checking `SCHEMA.md` for the soft-delete convention first.
- **Do not add npm dependencies casually.** This runs on Vercel/Neon free tiers — watch bundle size and serverless cold-start impact. Justify new dependencies.

## When You Add Something

- **New database model or field** → update `SCHEMA.md` in the same change, explaining what it's for and how it relates to existing models.
- **New API route** → update `API.md` with method, path, required role, request/response shape.
- **New UI component** → confirm it reuses `components/ui/` primitives before creating a new one from scratch. Add a loading skeleton and empty state if it renders a list or async data, per `DESIGN.md`.
- **New page/route** → confirm which role(s) can access it and place it under the correct route group (`app/(dashboard)/<role>/...`).

## Current Project State

- Architecture and design system: locked (`ARCHITECTURE.md`, `DESIGN.md`).
- SRS (feature scope): in progress — check `SRS.md` for current status before assuming a feature is in scope.
- Schema and API: scaffolded, not final — treat `SCHEMA.md` and `API.md` as living documents, not ground truth, until SRS is complete.

## If Something Is Ambiguous

If a requirement isn't covered by these docs (a feature not in `SRS.md`, a design case not in `DESIGN.md`), don't guess silently — state the assumption you're making inline in code comments or PR description, and flag it for human review rather than inventing a new pattern that conflicts with the rest of the repo.

## Credits

This project is developed by Usama Bhanbhro. Keep the footer credit ("Developed by Usama Bhanbhro") intact in the app shell — do not remove it when touching layout components.
