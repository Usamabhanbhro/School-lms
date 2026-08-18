# School LMS

A web-based Learning Management System for schools — attendance, marks/tests, report cards, certificates, and fee challans, managed by a school's Admin (Principal) and Teachers.

Full web app (no desktop client). Built to be usable from a phone browser, since class teachers need to mark attendance on the go.

**Status: Foundation skeleton (v0.1), SRS finalized at v4** (see `SRS.md`). The architecture, design system, authentication foundation, RBAC foundation, database schema, and routing shell were originally built against an earlier four-role assumption (Admin/Teacher/Student/Parent) — **that assumption is superseded.** Two login roles only: **Admin** (single account) and **Teacher** (multiple accounts). Students are data records, not accounts; there is no Parent access.

`SCHEMA.md` and `API.md` have been updated to match SRS v4, including a fully specified Fee Challan module (bank settings, snapshot-based challans, three-copy print structure). The Prisma schema, routes, and role pages **have not yet been rebuilt to match** — see `ROADMAP.md` for the phased build-out plan, starting with reconciling the stale `/student` and `/parent` routes before any new feature work.

Only the **visual/print design** for Certificates, the Fee Challan three-copy layout, and Report Cards remains genuinely open — everything else in SRS v4 is functionally specified and ready to build.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, React |
| ORM | Prisma (client generated to `src/generated/prisma`, gitignored) |
| Database | PostgreSQL (Neon, free tier) |
| Auth | NextAuth v4 (Credentials provider, JWT sessions) |
| Styling | Tailwind CSS v4 (CSS-first tokens in `src/app/globals.css`) |
| Icons | Lucide |
| Package manager | Bun (`bun.lock` is the single lockfile) |
| Hosting | Vercel (free tier) |

See `ARCHITECTURE.md` for the full stack rationale and system diagram.

## Documentation Index

Read these in order before making changes:

| File | Purpose |
|---|---|
| `ARCHITECTURE.md` | System design, stack decisions, data layer overview |
| `DESIGN.md` | Visual design system — colors, type, spacing, motion, components |
| `SRS.md` | Feature scope — **finalized (v4)**, Admin/Teacher only |
| `SCHEMA.md` | Database entities, fields, relationships — updated to match SRS v4 |
| `API.md` | API route list — updated to match SRS v4 |
| `ROADMAP.md` | Phased implementation build order |
| `CONVENTIONS.md` | Coding standards — naming, folder structure, styling, tooling |
| `AGENTS.md` | Instructions for AI coding tools working in this repo |

## Local Setup

```bash
# 1. Install dependencies (postinstall runs `prisma generate`)
bun install

# 2. Environment variables
cp example.env .env
#   DATABASE_URL     Neon Postgres connection string (required for auth + data routes)
#   NEXTAUTH_SECRET  generate with `openssl rand -base64 32`
#   NEXTAUTH_URL     http://localhost:3000 in local dev

# 3. Database — applies migrations (requires DATABASE_URL)
bun run db:migrate

# 4. Run the dev server
bun run dev
```

## Commands

| Command | Purpose |
|---|---|
| `bun run dev` | Dev server on `0.0.0.0:${PORT:-3000}` |
| `bun run build` | `prisma generate` + production build |
| `bun run start` | Serve the production build |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run db:migrate` | Apply/create migrations in dev |
| `bun run db:deploy` | Apply migrations in production |
| `bun run db:studio` | Prisma Studio |

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes (for auth + data routes) | Neon Postgres connection string |
| `NEXTAUTH_SECRET` | Yes (production) | NextAuth JWT signing secret |
| `NEXTAUTH_URL` | Yes (production) | Canonical app URL for auth callbacks |

No email/SMS/OAuth provider variables are required — Admin password recovery is self-service via a one-time recovery code (see `SRS.md` §1.7), not email-based. Do not add third-party service variables without a documented need.

## Roles

Two login roles (per SRS v4):

- **Admin** — the Principal, single account. Manages teachers, classes/sections/subjects, students, teacher attendance; oversees all student attendance, marks, and report cards; overrides locked attendance; generates certificates and fee challans; self-service password recovery via recovery code.
- **Teacher** — multiple accounts, scoped to assignments:
  - **Class Teacher** (one per class+section) — the only role that can mark/confirm student attendance for that class
  - **Subject Teacher** (per class+section+subject) — creates tests, enters marks, generates report cards for that subject

Students are **not** logins — they're records Admin creates and allots to a class/section. No Parent access in this version.

## Current Routes (pending reconciliation)

The routes below reflect the original four-role skeleton and predate SRS v4. `/student` and `/parent` should be removed; `/admin` and `/teacher` remain but their internal navigation/content needs to be rebuilt against SRS v4's actual feature set (attendance, tests/marks, report cards, certificates, fee challans) rather than the old placeholder shells.

| Route | Access | Status |
|---|---|---|
| `/` | Public | Landing page — content should be updated to reflect Admin/Teacher-only model |
| `/login` | Public | Sign in (NextAuth Credentials) |
| `/admin/recover` | Public | **Not yet built** — self-service admin password recovery (SRS §1.7) |
| `/register` | Public | Explains accounts are created by the school |
| `/dashboard` | Authenticated | Redirects to the signed-in user's role home |
| `/admin` | ADMIN | Role home — placeholder shell, needs rebuild against SRS v4 |
| `/teacher` | TEACHER | Role home — placeholder shell, needs rebuild against SRS v4 |
| `/student` | — | **Remove** — students are not logins under SRS v4 |
| `/parent` | — | **Remove** — no parent access under SRS v4 |
| `/api/auth/[...nextauth]` | — | NextAuth handler |
| `/api/users` | ADMIN | Reference RBAC route pattern — superseded by `/api/teachers` per `API.md`, keep as pattern reference or migrate |

## Intentionally Deferred (pending implementation, not pending SRS anymore)

The SRS is finalized for all of these — see `ROADMAP.md` for the phased build order:

- Class/Section/Subject management, Class Teacher & Subject Teacher assignment
- Student records (create/edit, class/section allotment)
- Student attendance (mark, confirm/lock, admin override, CSV export)
- Teacher attendance (admin-marked)
- Tests & marks entry
- Report card generation (test selection, on-the-fly Term creation)
- Admin self-service password recovery (recovery code flow)
- Fee Challan (bank settings, snapshot-based generation, line items)

Still genuinely undesigned/unspecified (see `SRS.md` Open Items — Phase 6 in `ROADMAP.md`):

- Certificate print layout (Leaving, Character)
- Fee Challan's three-copy print layout (structure confirmed — Bank/Student/School copies, one page — visual design is not)
- Report card print layout

Not in scope at all under SRS v4: Assignments/Submissions, Timetables, Announcements, Notifications/messaging, OAuth/email-based password reset, Library module.

## Deployment

Deployed via Vercel, git-push deploy from `main`. Database hosted on Neon. See `ARCHITECTURE.md` for free-tier constraints (Neon cold-start, Vercel function time limits). Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` in production, and run `bun run db:deploy` after deploying.

The foundation is deployable; the product is not — this is a skeleton, not a finished LMS.

## Credits

Developed by Usama Bhanbhro.
