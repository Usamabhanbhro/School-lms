# AGENTS.md

Instructions for any AI coding tool (Claude Code, Cursor, Copilot, etc.) working in this repository. Read this file first, before making any change.

## Before You Do Anything

1. Read `README.md` for project overview and setup.
2. Read `ARCHITECTURE.md` — do not deviate from the chosen stack (Next.js App Router, Prisma, Neon Postgres, NextAuth, Tailwind, Vercel) without it being an explicit, discussed decision.
3. Read `DESIGN.md` before writing or editing any UI — colors, type, spacing, motion, and component patterns are specified there and are not up for reinterpretation per-component.
4. Read `CONVENTIONS.md` before writing any code — folder structure, naming, API shape, and styling rules are defined there.
5. Check `SCHEMA.md` and `API.md` before adding a new database model or API route — these are **ground truth for what's already implemented**, not scaffolds. Check whether it already exists before adding anything.
6. Check `ROADMAP.md` for phase status before starting work — confirm which phase is actually next rather than assuming.

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

- Logo sizing: **verified with the real uploaded crest** (Vercel Blob PNG, ~339KB). Sign-in masthead renders `size-16` container / `size-14` img; desktop sidebar `size-16`/`size-14`; mobile header `size-12`/`size-10` — all `object-contain` + `overflow-hidden`. See `DESIGN.md` for the token table. (No headless browser in the sandbox — rendered-DOM/config evidence is used for logo verification, not a screenshot.)
- Architecture and design system: locked (`ARCHITECTURE.md`, `DESIGN.md`).
- SRS: **finalized (v10)** — three login roles (Admin, Academics, Teacher). Treat `SRS.md` as complete for all core flows, including the v10 amendments: Academics has full teacher-attendance marking parity (§1.4/§1A) and can generate salary slips while only Admin configures rates (§1.10).
- Schema and API: **implemented, not scaffolds.** Phases 0–9 in `ROADMAP.md` are complete — `SCHEMA.md` and `API.md` describe real, working models and routes, marked `Status: implemented` per route in `API.md`. Do not redesign or re-scaffold anything documented there without a specific reason; extend it. Salary Slip ships with a coded print layout as a documented assumption; `DocumentTemplateType.SALARY_SLIP` is reserved for a template-based print later.
- Session idle timeout: 15 minutes, client-side (signOut → `/login?expired=1` with a clear message), mounted in the dashboard layout — applies to all three roles. Verified with a lowered threshold (5s) then restored.

## If Something Is Ambiguous

If a requirement isn't covered by these docs (a feature not in `SRS.md`, a design case not in `DESIGN.md`), don't guess silently — state the assumption you're making inline in code comments or PR description, and flag it for human review rather than inventing a new pattern that conflicts with the rest of the repo.

## Credits

This project is developed by Usama Bhanbhro. Keep the footer credit ("Developed by Usama Bhanbhro") intact in the app shell — do not remove it when touching layout components.
