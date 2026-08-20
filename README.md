# School LMS

A web-based Learning Management System for schools — attendance, marks/tests, report cards, certificates, and fee challans, managed by a school's Admin (Principal), Academics staff, and Teachers.

Full web app (no desktop client). Built to be usable from a phone browser, since class teachers need to mark attendance on the go.

**Status: Phases 0–6 implemented. Admin provisioning, school settings, and hardened admin self-recovery added.** SRS finalized at v5 (see `SRS.md`). Three login roles: **Admin** (single account, the Principal), **Academics** (multiple accounts, delegated certificate/challan generation), and **Teacher** (multiple accounts, Class Teacher and/or Subject Teacher assignments). Students are data records, not accounts; there is no Parent access.

`SCHEMA.md` and `API.md` are current with SRS v5. Every route through Fee Challans is built and functional. Print layouts for Certificates, Fee Challans (three-copy), and Report Cards are implemented with database-backed school identity configuration.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, React |
| ORM | Prisma (client generated to `src/generated/prisma`, gitignored) |
| Database | PostgreSQL (Neon, free tier) |
| Auth | NextAuth v4 (Credentials provider, JWT sessions) |
| Styling | Tailwind CSS v4 (CSS-first tokens via `@theme` in `src/app/globals.css` — no `tailwind.config.ts`) |
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
| `SRS.md` | Feature scope — **finalized (v5)**, Admin/Academics/Teacher |
| `SCHEMA.md` | Database entities, fields, relationships — current with SRS v5 |
| `API.md` | API route list — current with SRS v5, Phases 0–6 marked implemented |
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
| `BLOB_READ_WRITE_TOKEN` | Yes (for logo upload) | Vercel Blob storage token — see [Vercel Blob docs](https://vercel.com/docs/storage/vercel-blob) |

No email/SMS/OAuth provider variables are required — Admin password recovery is self-service via a one-time recovery code (see `SRS.md`), not email-based. The `BLOB_READ_WRITE_TOKEN` is required only for school logo upload — see `ARCHITECTURE.md` for setup.

## Roles

Three login roles (per SRS v5):

- **Admin** — the Principal, single account. Manages teachers, academics staff, classes/sections/subjects, students, teacher attendance; oversees all student attendance, marks, and report cards; overrides locked attendance; generates certificates and fee challans; edits bank settings; self-service password recovery via recovery code.
- **Academics** — multiple accounts, delegated staff. Generates certificates and fee challans (line items + print). Read-only oversight of student lists, attendance records, tests, marks, and report cards for context. Cannot manage users, create/edit classes/subjects, assign teachers, or edit bank settings.
- **Teacher** — multiple accounts, scoped to assignments:
  - **Class Teacher** (one active per class+section) — the only role that can mark/confirm student attendance for that class
  - **Subject Teacher** (per class+section+subject) — creates tests, enters marks; the active Class Teacher generates the report card, pulling from tests across any subject in the class

Students are **not** logins — they're records Admin creates and allots to a class/section. No Parent access in this version.

## Current Routes

| Route | Access | Status |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Sign in (NextAuth Credentials) |
| `/register` | Public | Explains accounts are created by the school |
| `/admin/signup` | Public | First admin provisioning (only when no Admin exists) |
| `/admin/recover` | Public | Self-service admin password recovery — implemented |
| `/dashboard` | Authenticated | Redirects to the signed-in user's role home |
| `/admin/settings` | ADMIN | School identity settings (name, address, phone, email, logo) |
| `/admin/dashboard` | ADMIN | Admin dashboard with stats |
| `/admin/teachers` | ADMIN | Teacher management |
| `/admin/academics` | ADMIN, ACADEMICS | Academics staff management (Admin CRUD, Academics read) |
| `/admin/classes` | ADMIN | Class/section management with teacher assignments |
| `/admin/subjects` | ADMIN | Subject management |
| `/admin/students` | ADMIN | Student management |
| `/admin/attendance` | ADMIN | Attendance overview and overrides |
| `/admin/teacher-attendance` | ADMIN | Teacher attendance management |
| `/admin/tests` | ADMIN, ACADEMICS | Tests & marks oversight (read-only) |
| `/admin/report-cards` | ADMIN, ACADEMICS | Report cards list (read-only) |
| `/admin/certificates` | ADMIN, ACADEMICS | Certificate generation |
| `/admin/fees` | ADMIN, ACADEMICS | Fee challan generation |
| `/admin/templates` | ADMIN | Document template management (upload, visual editor, activate) |
| `/teacher` | TEACHER | Teacher dashboard and quick actions |
| `/teacher/attendance` | TEACHER | Student attendance marking (draft → lock) |
| `/teacher/tests` | TEACHER | Tests & marks entry |
| `/teacher/report-cards` | TEACHER | Report card generation |
| `/print/certificates/[id]` | ADMIN, ACADEMICS | Certificate print view (Leaving + Character) |
| `/print/fee-challans/[id]` | ADMIN, ACADEMICS | Fee Challan print view (3 copies: Bank/Student/School) |
| `/print/report-cards/[id]` | ADMIN, ACADEMICS | Report Card print view |
| `/api/auth/[...nextauth]` | — | NextAuth handler |
| `/api/admin/signup` | Public | Create first admin account (only when no Admin exists) |
| `/api/admin/recover` | Public | Recovery code verification + password reset — rate limited |
| `/api/admin/recover/code` | Public | Generate new recovery code (for expired/consumed codes) |
| `/api/admin/recovery-code` | ADMIN | Manually rotate recovery code |
| `/api/settings/school` | ADMIN (write), ACADEMICS (read) | School identity settings |
| `/api/settings/school/logo` | ADMIN | Upload/remove school logo |
| `/api/teachers` | ADMIN | Teacher CRUD |
| `/api/teachers/:id/reset-password` | ADMIN | Reset a teacher's password |
| `/api/academics` | ADMIN | Academics staff CRUD |
| `/api/academics/:id/reset-password` | ADMIN | Reset an academics user's password |
| `/api/class-sections` | ADMIN (write), TEACHER (scoped read), ACADEMICS (read) | Class section management |
| `/api/class-sections/:id/class-teacher` | ADMIN | Assign/reassign Class Teacher |
| `/api/class-sections/:id/subject-teachers` | ADMIN | Assign Subject Teacher |
| `/api/subjects` | ADMIN (write), TEACHER + ACADEMICS (read) | Subject management |
| `/api/students` | ADMIN (write), TEACHER (scoped read), ACADEMICS (read) | Student CRUD |
| `/api/teacher-attendance` | ADMIN | Mark/edit teacher attendance directly |
| `/api/attendance` | TEACHER (Class Teacher only, write), ADMIN + ACADEMICS (read) | Student attendance draft |
| `/api/attendance/:classSectionId/:date/confirm` | TEACHER (Class Teacher) | Lock a draft attendance sheet |
| `/api/attendance/:id` | ADMIN | Override a locked record |
| `/api/attendance/export` | ADMIN, ACADEMICS, TEACHER (own class) | CSV export |
| `/api/tests` | TEACHER (Subject Teacher, write), ADMIN + ACADEMICS (read) | Test creation |
| `/api/tests/:id/marks` | TEACHER (Subject Teacher) | Enter/update marks |
| `/api/terms` | TEACHER | Create a Term label on the fly |
| `/api/report-cards` | TEACHER (Class Teacher, write), ADMIN + ACADEMICS (read) | Report card generation |
| `/api/certificates` | ADMIN, ACADEMICS | Certificate generation |
| `/api/settings/bank` | ADMIN (write), ACADEMICS (read) | Bank settings for challans |
| `/api/students/:id/fee-challans` | ADMIN, ACADEMICS | Generate/list fee challans for a student |
| `/api/fee-challans/:id` | ADMIN, ACADEMICS | Retrieve a saved challan |

Full request/response shapes for every route above are in `API.md`.

## Deployment Architecture

**One deployment = one school.** Each school gets its own application instance and database. There is no multi-tenant SaaS architecture — School B receives its own deployment with a fresh database, starts with the Admin Onboarding screen, and creates its own Admin account.

A PostgreSQL partial unique index enforces that exactly one Admin account can exist per database, preventing concurrent signup race conditions at the database level.

Multi-tenant SaaS deployment is a planned future enhancement — not yet implemented.

## Remaining Work

- **Visual design for print documents** — Report Card, Leaving Certificate, Character Certificate, and Fee Challan layouts are structural placeholders. Final designs will be supplied later. The data/configuration layer is complete and flexible.

## Admin Self-Recovery

The single Admin account uses a one-time recovery code for password reset. **There is NO email recovery** — this is a completely offline, self-contained system.

### Recovery Lifecycle

1. **Signup**: Admin account created → recovery code generated → plaintext displayed **once** → only bcrypt hash stored → code valid until used or regenerated
2. **Replacement**: If code expires/is consumed → Admin requests new code via the UI → previous code invalidated → new code displayed once
3. **Password Reset**: Admin submits recovery code + new password → old code consumed, password changed, and new recovery code generated — all **atomically** in one database transaction → new code displayed once
4. **Manual Rotation**: Admin can rotate their recovery code at any time from within the admin panel

### Key Properties

- **Single active code**: At most one recovery code is valid per Admin at any time (enforced by Prisma transaction + database partial unique index)
- **No time-based expiry**: Codes remain valid indefinitely until used (consumed) or manually regenerated
- **Single-use**: Consumed atomically on successful password reset
- **Only hashes stored**: Plaintext codes exist only during generation, in the API response, and in the browser UI until the user leaves
- **Cryptographically secure**: 64 hex characters (256 bits of entropy) via `crypto.randomBytes()`
- **Atomic operations**: All lifecycle operations run in Prisma transactions
- **Rate limited**: Public endpoints rate-limited (5 attempts / 15 min for recovery, 3 attempts / 15 min for code generation, per IP)

### Known Limitations

- **JWT session persistence**: Existing JWT sessions are not invalidated after a password change. The old password can no longer authenticate, but pre-existing session tokens remain valid until they expire (default 30 days). This is inherent to JWT-based auth without a token blocklist.
- **In-memory rate limiting**: Rate limits are per serverless function instance on Vercel. Concurrent function invocations have separate counters. This is documented transparently rather than pretending it provides distributed protection.

Not in scope at all under SRS v5: Assignments/Submissions, Timetables, Announcements, Notifications/messaging, OAuth/email-based password reset, Library module.

## School Identity Configuration

School identity (name, address, phone, email, principal name, logo) is stored in the database via the `SchoolSettings` model and managed through the Admin Settings UI at `/admin/settings`.

The `getSchoolSettings()` accessor in `src/lib/school-settings.ts` provides server-side access. All print layouts and the print preview header read from this database-backed configuration:

- Leaving Certificate
- Character Certificate
- Fee Challan (3 copies)
- Report Card
- Print preview header

On a fresh deployment, default placeholder values are used until the Admin configures school identity through the Settings page.

## Deployment

Deployed via Vercel, git-push deploy from `main`. Database hosted on Neon. File uploads (school logo) use Vercel Blob storage. See `ARCHITECTURE.md` for free-tier constraints (Neon cold-start, Vercel function time limits). Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `BLOB_READ_WRITE_TOKEN` in production, and run `bun run db:deploy` after deploying.

## Credits

Developed by Usama Bhanbhro.
