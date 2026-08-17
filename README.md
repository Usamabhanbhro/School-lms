# School LMS

A web-based Learning Management System for schools — attendance, gradebooks, assignments, timetables, and communication across Admin, Teacher, Student, and Parent roles.

Full web app (no desktop client). Built to be usable from a phone browser, since teachers need to mark attendance on the go.

> **Status: foundation skeleton (v0.1).** The architecture, design system, auth, RBAC, database schema, and routing shell are verified and frozen. **No LMS features are implemented yet.** The SRS (`SRS.md`) is not finalized, so all product functionality is intentionally deferred pending it. Do not treat this repository as a finished product.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, React |
| ORM | Prisma 7 (client generated to `src/generated/prisma`, gitignored) |
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
| `SRS.md` | Feature scope — **not finalized; do not implement features** |
| `SCHEMA.md` | Database entities, fields, relationships (companion to `schema.prisma`) |
| `API.md` | API route list — method, path, required role, request/response shape |
| `CONVENTIONS.md` | Coding standards — naming, folder structure, styling, tooling |
| `AGENTS.md` | Instructions for AI coding tools working in this repo |

## Current Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Sign in (NextAuth Credentials) |
| `/register` | Public | Explains accounts are created by the school — no self-registration |
| `/dashboard` | Authenticated | Redirects to the signed-in user's role home |
| `/admin` | ADMIN | Role home — placeholder shell |
| `/teacher` | TEACHER | Role home — placeholder shell |
| `/student` | STUDENT | Role home — placeholder shell |
| `/parent` | PARENT | Role home — placeholder shell |
| `/api/auth/[...nextauth]` | — | NextAuth handler (login/logout/session) |
| `/api/users` | ADMIN | List / create users — the reference RBAC route pattern |

Role pages are placeholders only. Role navigation (sidebar) is wired; module links are marked "planned" until the SRS defines them.

## Local Setup

```bash
# 1. Install dependencies (postinstall runs `prisma generate`)
bun install

# 2. Environment variables
# Copy the template and fill in real values — never commit .env
cp example.env .env
#   DATABASE_URL     Neon Postgres connection string (required for auth + data routes)
#   NEXTAUTH_SECRET  generate with `openssl rand -base64 32`
#   NEXTAUTH_URL     http://localhost:3000 in local dev

# 3. Database — applies the baseline migration (requires DATABASE_URL)
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
| `bun run db:migrate` | Apply/create migrations in dev (`prisma migrate dev`) |
| `bun run db:deploy` | Apply migrations in production (`prisma migrate deploy`) |
| `bun run db:studio` | Prisma Studio |

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes (for auth + data routes) | Neon Postgres connection string. The app boots without it, but sign-in and every data route need it. Missing values produce a descriptive error from `lib/prisma.ts`. |
| `NEXTAUTH_SECRET` | Yes (production) | NextAuth JWT signing secret. NextAuth warns in dev if unset. |
| `NEXTAUTH_URL` | Yes (production) | Canonical app URL for auth callbacks. Inferred from the request in dev. |

NextAuth v4 reads the `NEXTAUTH_*` names above (the `AUTH_*` aliases apply to Auth.js v5 — this repo is locked to v4). No other variables are required by the skeleton; do not add third-party service variables without a documented need.

## Intentionally Deferred (pending SRS)

- All feature modules: attendance, gradebooks, assignments, timetables, announcements
- User / student / teacher / parent management workflows, enrollments, classes, subjects
- Notifications, messaging, payments, reports, analytics, file uploads, email / SMS / push
- OAuth providers, password reset, email verification
- Fee & library modules (also open in `ARCHITECTURE.md`)
- Lint and test tooling (no framework chosen yet — see `CONVENTIONS.md`)
- File storage provider (leaning Cloudflare R2 — see `ARCHITECTURE.md`)

## Roles

- **Admin** — school setup, user management, reporting
- **Teacher** — attendance, grades, assignments, class materials
- **Student** — courses, submissions, grades, timetable
- **Parent** — child's progress, attendance, notices

Role behavior is enforced at the API layer (`lib/rbac.ts`) and reflected in UI navigation (see `DESIGN.md` sidebar spec).

## Deployment

Deployed via Vercel, git-push deploy from `main`. Database hosted on Neon. See `ARCHITECTURE.md` for free-tier constraints (Neon cold-start, Vercel function time limits). Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` in the production environment, and run `bun run db:deploy` against the production database after deploying.

## Credits

Developed by Usama Bhanbhro.
