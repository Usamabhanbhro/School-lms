# School LMS — Architecture

This document defines the technical architecture for the School LMS. Any AI or developer working on this project should follow this spec for consistency. SRS/feature list will be added separately and should map onto this architecture, not replace it.

## Summary

Full web application (no Electron, no desktop client). Single Next.js codebase serving both frontend and backend, deployed to Vercel free tier, with PostgreSQL hosted on Neon free tier. Primary usage pattern: desktop for admin dashboards/reports, mobile browser for teachers marking attendance on the go.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) | Frontend + backend in one codebase |
| Language | TypeScript | |
| ORM | Prisma | Migrations, type-safe queries |
| Database | PostgreSQL (Neon, free tier) | Serverless Postgres; note cold-start on inactivity and storage cap on free tier |
| Auth | NextAuth (Auth.js), Credentials provider | Username/password auth against local `users` table; JWT-based sessions |
| Styling | Tailwind CSS | Config tokens should map 1:1 to DESIGN.md |
| Icons | Lucide | Single icon library, per DESIGN.md |
| Hosting | Vercel (free tier) | Git-push deploy, automatic SSL, serverless functions |
| File storage | Vercel Blob (persistent, serverless-native) | School logo upload. Requires `BLOB_READ_WRITE_TOKEN` env var. |

## Why this stack (decisions made and rationale)

- **No Electron**: Originally considered for a desktop app, but dropped once it was clear teachers need to mark attendance from their phones — Electron does not run on mobile. A responsive web app covers phone, tablet, and desktop from one codebase.
- **Next.js over separate Express backend**: One codebase for frontend + API routes reduces deployment complexity and pairs natively with Vercel.
- **Neon over self-managed Postgres**: Free tier, managed backups, works well with Prisma. Avoids the risk of losing grade/attendance data to unmanaged VPS issues.
- **NextAuth Credentials over custom JWT**: School auth is simple username/password per role, not OAuth/social login. NextAuth handles session management for free while still allowing full control over the credentials check against the Postgres `users` table.
- **Vercel over VPS + Nginx**: Removes ops burden (SSL, reverse proxy, scaling) entirely. Was originally planned as VPS but changed once cost/simplicity were prioritized.

## Roles & Access

Role-based access control (RBAC), three login roles (SRS v5):
- **Admin** (single account, the Principal) — school setup, teacher/academics management, class/subject/student management, attendance oversight, report cards, certificates, fee challans, bank settings
- **Academics** (multiple accounts) — delegated certificate and fee challan generation; read-only oversight of students, attendance, tests, marks, report cards
- **Teacher** (multiple accounts) — attendance marking (class teacher only), tests & marks, report card generation; scoped to assigned classes/subjects

Students are data records, not logins. No Parent access.

RBAC is enforced at the API route level (`lib/rbac.ts`) and reflected in UI navigation (nav items differ per role — see DESIGN.md sidebar spec).

## High-Level System Diagram

```
Browser (desktop or mobile)
   |
   |  HTTPS
   v
Vercel — Next.js App Router
   ├── App Router pages (React Server Components) — role-aware UI
   ├── API Route Handlers (app/api/**) — business logic
   ├── NextAuth — session/auth, Credentials provider
   └── Prisma Client
          |
          v
   Neon — PostgreSQL (serverless)
```

## Known Free-Tier Constraints (plan around these)

- **Neon**: database auto-suspends after inactivity (cold-start delay on first request after idle); storage cap on free tier — verify current limits before scaling.
- **Vercel**: serverless function execution time limit (10s default) — fine for typical CRUD, but heavy operations (e.g. bulk PDF report card generation) may need a background job approach or queue later, not synchronous API routes.

Both are easy to upgrade incrementally; starting on free tiers is low-risk for initial build and pilot use.

## Data Layer Notes

- The **Prisma schema** (`prisma/schema.prisma`, documented in `SCHEMA.md`) covers the SRS v5 entities: User (ADMIN/TEACHER/ACADEMICS), TeacherProfile, AcademicsProfile, ClassSection, Subject, ClassTeacherAssignment, SubjectTeacherAssignment, Student, StudentAttendance, TeacherAttendance, Test, Mark, Term, ReportCard, ReportCardTest, Certificate, BankSettings, FeeChallan, FeeChallanLineItem, and the new FeeChallanPayment ledger records. Schema is reconciled with SRS v15 — see `ROADMAP.md` for implementation phases.
- Fee Ledger payments are separate append-only child records of immutable FeeChallan snapshots. Payment totals, outstanding balance, and Pending/Partial/Paid status are derived at read time rather than cached, keeping the financial state auditable and preventing status drift. The school-wide ledger is a role-protected read API and Admin/Academics page with server-side filters.
- The on-demand backup export is intentionally stateless: an Admin-only read route serializes the existing Prisma models into one JSON attachment, with stable schema metadata and no Backup table or background job. Authentication secrets are excluded; foreign keys and append-only histories remain in the bundle for lossless restoration.
- Global Search is also stateless: the shared Admin/Academics dashboard trigger calls one role-protected endpoint that queries existing active models and returns bounded transient result objects. Teachers retain their assignment-scoped workflows and are intentionally excluded from the school-wide trigger and endpoint.
- The design-system completion pass remains presentation-only. It strengthens shared focus, hover, state, and responsive behavior across existing screens without changing the color, type, square-corner, border, icon, or motion decisions documented in DESIGN.md.
- Historical date rules are enforced at both UI and route boundaries using the school's Asia/Karachi local date. Attendance, Daily Agenda, salary-slip periods, fee payments, and Fee Ledger date filters reject future values; FeeChallan issuance remains server-generated. Shared range validation also rejects a From date after To.
- The generated Prisma client lives in `src/generated/prisma` (gitignored, regenerated by `postinstall`/`build`).
- Tabular/numeric fields (grades, roll numbers, IDs) should be modeled to support tabular-figure display per DESIGN.md.

## Print & Export

Document print output (Certificates, Report Cards, Fee Challans) uses a **template-based rendering system** (see SRS §3). Admin uploads a background image, places data fields at percentage-based coordinates, and the renderer overlays text on the background at print time.

**Rendering approach:** A shared print view component (`/print/[type]/[id]`) fetches the active template (or the document's snapshot template), its field positions (`TemplateField`), table regions (`TemplateTableRegion`), and the actual document data. It renders the background image via CSS and absolutely positions text at saved percentage coordinates. For table regions, it lays out N rows starting at an anchor point, incrementing y by rowHeight per row.

**Client-side PDF conversion:** PDF templates are converted to PNG client-side in the browser (using pdf.js rendering to canvas) before upload — avoids heavy server-side dependencies and sidesteps Vercel's execution time limits.

**Template versioning:** Each generated document records the `templateId` that was active when it was created. Changing the active template does not reflow historical documents.

## Open / Not Yet Decided

- Background job strategy for anything exceeding Vercel's serverless time limits (e.g. bulk report generation)
- Multi-school / multi-tenancy — currently assumed single school per deployment; revisit if that changes

> **Note:** This document is current with SRS v15 — stack rationale, role list, entity list, deployment constraints, Fee Ledger, backup export, scoped Global Search, presentation-only design-system completion, and future-date validation reflect the current state (see `ROADMAP.md`).
