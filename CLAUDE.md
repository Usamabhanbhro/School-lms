# CLAUDE.md — School LMS

AI context file for this repository. Read this first, then consult the linked docs for depth.

---

## What This Project Is

A web-based Learning Management System for a single school. Handles attendance, tests/marks, report cards, certificates, fee challans, salary slips, and daily agenda — usable on both desktop and mobile. **One deployment = one school.** No multi-tenant SaaS.

**Current state:** All Phases 0–16 implemented and verified. Nothing blocking. SRS is finalized at v15.

---

## Read Order (before making any change)

| File | When to read |
|---|---|
| `AGENTS.md` | Always — hard rules for AI tools |
| `ARCHITECTURE.md` | Before any stack or data-layer decision |
| `DESIGN.md` | Before any UI change |
| `CONVENTIONS.md` | Before writing any code |
| `SCHEMA.md` | Before adding a DB model or field |
| `API.md` | Before adding or changing an API route |
| `SRS.md` | For feature scope and role rules (v15 final) |
| `ROADMAP.md` | For phase status and implementation history |
| `RECOVERY.md` | Admin lockout only — internal runbook |

---

## Stack (locked — do not change without explicit discussion)

| Layer | Choice |
|---|---|
| Framework | Next.js App Router, TypeScript |
| ORM | Prisma → `src/generated/prisma` (gitignored) |
| Database | PostgreSQL on Neon (free tier) |
| Auth | NextAuth v4, Credentials provider, JWT sessions |
| Styling | Tailwind CSS v4, CSS-first via `@theme` in `globals.css` — no `tailwind.config.ts` |
| Icons | Lucide only |
| Package manager | Bun (`bun.lock`) |
| Hosting | Vercel free tier |
| File storage | Vercel Blob (`BLOB_READ_WRITE_TOKEN`) — school logo only |

---

## Roles

- **Admin** — single account (the Principal). Full control: users, classes, students, attendance overrides, bank settings, salary rates, recovery code rotation.
- **Academics** — multiple accounts. Delegated: certificates, fee challans, salary-slip generation, teacher attendance (full parity with Admin). Read-only on tests/marks/report cards.
- **Teacher** — multiple accounts, scoped to assignments:
  - *Class Teacher* — marks/confirms student attendance for their class
  - *Subject Teacher* — creates tests, enters marks; Class Teacher generates report cards

Students are **data records, not logins**. No Parent access.

---

## Hard Rules (summary — full list in `AGENTS.md`)

- **RBAC on every API route.** Use `lib/rbac.ts` helpers — never inline role checks.
- **No hard-deletes of academic records.** Check `SCHEMA.md` for soft-delete convention (`isActive: false` on Students).
- **No new stack choices** without flagging and confirmation.
- **No deviating from `DESIGN.md` tokens.** Square corners, 1px borders, Inter font, Lucide icons, 8px spacing scale.
- **No new npm dependencies** without justification — free-tier bundle and cold-start sensitivity.
- **Update `SCHEMA.md`** when adding a model/field. Update `API.md` when adding a route.
- **Keep footer credit** — "Developed by Usama Bhanbhro" — intact in layout components.

---

## Design System (summary — full spec in `DESIGN.md`)

- **Aesthetic:** industrial, minimal, functional. No gradients, no decorative shadows, no rounded shapes.
- **Colors:** `#FFFFFF` bg, `#0F172A` text, `#2563EB` primary, `#16A34A` success, `#DC2626` danger, `#F1F5F9` surface, `#E2E8F0` border.
- **Corners:** square (`border-radius: 0`; 2px max for checkboxes only).
- **Elevation:** 1px borders, not shadows.
- **Font:** Inter. Tabular figures on all numeric columns.
- **Spacing:** strict 8px scale — 4, 8, 16, 24, 32, 48, 64.
- **Motion:** opens 150–200ms ease-out, closes 100–150ms ease-in. Respect `prefers-reduced-motion`.
- **Status indicators:** always pair color with icon/shape (never color alone).
- **Tables:** `density="compact"` (default, desktop) or `density="comfortable"` (mobile/teacher).
- **Toasts:** square, left accent bar, auto-dismiss with animated progress bar. `ConfirmDialog` for all destructive actions — never hand-roll inline confirmations.

---

## Key Conventions (full spec in `CONVENTIONS.md`)

```
src/
  app/
    (auth)/           # login, register — public
    (dashboard)/
      admin/          # admin-only pages
      academics/      # academics-only pages
      teacher/        # teacher-only pages
    api/<resource>/   # REST route handlers
  components/
    ui/               # shared primitives
    <feature>/        # feature components
  lib/
    prisma.ts         # Prisma singleton
    auth.ts           # NextAuth config
    rbac.ts           # role-check helpers
prisma/schema.prisma
```

- Files: `kebab-case.tsx` components, `camelCase.ts` utilities.
- API routes: plural, REST-shaped. Response: `{ data: ... }` success, `{ error: { message, code } }` error.
- Server Components by default; `"use client"` only when interactivity is needed.
- Every list view needs a loading skeleton + empty state.
- Validate on both client (Zod) and server. Never trust client-only validation.
- Tailwind only — no separate CSS files, no arbitrary hex values, no inline `style={}` unless truly dynamic.

---

## Dev Commands

```bash
bun install          # install (postinstall runs prisma generate)
bun run dev          # dev server on 0.0.0.0:3000
bun run typecheck    # tsc --noEmit
bun run build        # prisma generate + production build
bun run db:migrate   # apply/create migrations (dev)
bun run db:deploy    # apply migrations (production)
bun run db:studio    # Prisma Studio
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `NEXTAUTH_SECRET` | Yes (prod) | JWT signing secret |
| `NEXTAUTH_URL` | Yes (prod) | Canonical app URL |
| `BLOB_READ_WRITE_TOKEN` | Yes (logo upload) | Vercel Blob token |

---

## Architecture Notes

- **Free-tier constraints:** Neon auto-suspends (expect cold-start delay); Vercel serverless 10s function limit. Heavy ops (bulk PDF) may need a background job strategy — not yet implemented.
- **Print system:** Template-based (`DocumentTemplate` / `TemplateField` / `TemplateTableRegion`). PDF→PNG conversion is client-side via `pdfjs-dist`. Print views at `/print/certificates/[id]`, `/print/fee-challans/[id]`, `/print/report-cards/[id]`, `/print/salary-slips/[id]`. **Wrap all print-page Prisma calls in try/catch** — each is a separate Neon connection that can fail independently.
- **Fee Ledger:** Payments are append-only child records. Status and balance are derived at read time — never stored.
- **Backup export:** `GET /api/backup/export` (Admin only) — stateless, single JSON attachment. Excludes all auth secrets.
- **Session idle timeout:** 15 minutes, client-side via `signOut` → `/login?expired=1`. No server-side JWT revocation.
- **Admin recovery:** one-time recovery code, no email. Hash only stored; plaintext shown once.
- **Migration chain:** 21 migrations validated. Low-priority: one duplicate Admin partial index can be dropped in a future safe window.

---

## Out of Scope (do not add without new SRS discussion)

Assignments/Submissions, Timetables, Announcements, Notifications/messaging, OAuth/email-based password reset, Library module, multi-tenant SaaS.
