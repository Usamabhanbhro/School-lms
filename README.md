# School LMS

A web-based Learning Management System for schools — attendance, gradebooks, assignments, timetables, and communication across Admin, Teacher, Student, and Parent roles.

Full web app (no desktop client). Built to be usable from a phone browser, since teachers need to mark attendance on the go.

## Stack

- **Framework**: Next.js (App Router), TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL (Neon, free tier)
- **Auth**: NextAuth (Credentials provider)
- **Styling**: Tailwind CSS
- **Icons**: Lucide
- **Hosting**: Vercel (free tier)

See `ARCHITECTURE.md` for the full stack rationale and system diagram.

## Documentation Index

Read these in order before making changes:

| File | Purpose |
|---|---|
| `ARCHITECTURE.md` | System design, stack decisions, data layer overview |
| `DESIGN.md` | Visual design system — colors, type, spacing, motion, components |
| `SRS.md` | Feature scope, role-by-role user stories |
| `SCHEMA.md` | Database entities, fields, relationships (plain-English companion to `schema.prisma`) |
| `API.md` | API route list — method, path, required role, request/response shape |
| `CONVENTIONS.md` | Coding standards — naming, folder structure, commit style, error handling |
| `AGENTS.md` | Instructions specifically for AI coding tools working in this repo |

**Note:** `SRS.md`, `SCHEMA.md`, and `API.md` are scaffolded but not yet finalized — feature scope is still being defined. Do not treat entities/routes in those files as final until the SRS is complete.

## Local Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd school-lms
npm install

# 2. Environment variables
cp .env.example .env
# Fill in DATABASE_URL (Neon connection string), NEXTAUTH_SECRET, NEXTAUTH_URL

# 3. Database
npx prisma migrate dev
npx prisma generate

# 4. Run
npm run dev
```

## Roles

- **Admin** — school setup, user management, reporting
- **Teacher** — attendance, grades, assignments, class materials
- **Student** — courses, submissions, grades, timetable
- **Parent** — view child's progress, attendance, notices

## Deployment

Deployed via Vercel, git-push deploy from `main`. Database hosted on Neon. See `ARCHITECTURE.md` for free-tier constraints to be aware of (Neon cold-start, Vercel function time limits).

## Credits

Developed by Usama Bhanbhro.
