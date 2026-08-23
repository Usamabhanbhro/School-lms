# School LMS — Implementation Roadmap

Build order for reconciling and implementing the SRS (v5). Each phase unlocks the next — don't skip ahead, since later phases read data/patterns established earlier.

**Status: Phases 0–9 implemented and verified. Admin provisioning, school settings, hardened admin self-recovery, certificate/fee-challan generation UIs, document template system, teacher attendance rework (Admin + Academics), Teacher Salary Slips, student admission optional fields, student archive ("Past Students") with partial unique indexes, and session idle timeout added. Migration chain validated from empty database (17 migrations). See `API.md` for per-route status.**

## Phase 0 — Reconciliation ✅ Complete

The existing skeleton was built against an earlier four-role assumption (Admin/Teacher/Student/Parent). Before any new feature work:

- Remove `/student` and `/parent` routes and their placeholder shells
- Rewrite `prisma/schema.prisma` from scratch to match `SCHEMA.md` (current models: `User`, `TeacherProfile`, `AcademicsProfile`, `ClassSection`, `Subject`, `ClassTeacherAssignment`, `SubjectTeacherAssignment`, `Student`, `StudentAttendance`, `TeacherAttendance`, `Test`, `Mark`, `Term`, `ReportCard`, `ReportCardTest`, `Certificate`, `BankSettings`, `FeeChallan`, `FeeChallanLineItem`)
- Three-role enum: `ADMIN`, `TEACHER`, `ACADEMICS`
- Run a fresh migration; the old migration history tied to the four-role schema should not carry forward
- Decide whether `/api/users` (the existing RBAC reference route) becomes `/api/teachers` or stays as a pattern reference only — see `API.md`

This is cleanup, not new functionality. Nothing in later phases should be built on top of the stale model.

## Phase 1 — Core Entities ✅ Complete

Admin-only CRUD with full management UIs:

- Teacher: create (with CNIC/phone format validation), edit, delete, revoke, admin-driven password reset — **UI: `/admin/teachers` via `UserManagement` component**
- Academics: create (with CNIC/phone format validation), edit, delete, revoke, admin-driven password reset (same CRUD pattern as Teacher) — **UI: `/admin/academics` via `UserManagement` component**
- ClassSection: create/edit — **UI: `/admin/classes` via `ClassSectionManagement` component with class teacher and subject teacher assignment dialogs**
- Subject: create/edit — **UI: `/admin/subjects` via `SubjectManagement` component**
- ClassTeacherAssignment: assign/reassign the one class teacher per class (deactivate old on reassignment, never two active) — **UI: inline in ClassSection table**
- SubjectTeacherAssignment: assign teachers to class+subject combinations — **UI: inline in ClassSection table**
- Student: create/edit, allot to class+section (name, guardian name, guardian CNIC, DOB, admission date) — **UI: `/admin/students` via `StudentManagement` component with client-side CNIC validation**

Everything downstream reads from this layer, so get the RBAC scoping right here first — Teacher views should already correctly filter to "my assigned classes only" even before there's attendance/marks data to show.

## Phase 2 — Auth Completeness ✅ Complete

- Admin recovery code: generate + display once at initial admin setup, stored via `AdminRecoveryCode` model — no time-based expiry, valid until used or manually regenerated
- `POST /api/admin/recover`: verify code, consume it atomically with password change and new code generation in one Prisma transaction via `consumeAndRotate()`
- `POST /api/admin/recover/code`: public endpoint to generate a new code when current one is expired/consumed — generic responses prevent account enumeration
- Manual regenerate-code action from within the admin panel
- Recovery UI at `/admin/recover` with no-email model explanation, copy-to-clipboard for recovery codes, states for valid/expired/consumed/replaced codes, and new-code-display-after-recovery
- Rate limiting on all public recovery and admin signup routes (documented in-memory limitation)
- Public admin signup (`/admin/signup`): first-time provisioning with server-side singleton check, database-level partial unique index, and race-safe transaction
- School Settings API and UI (`/admin/settings`): school name, address, phone, email, principal, logo upload/remove — Admin-only mutations
- Database-backed school identity: `getSchoolSettings()` accessor used by all print layouts

### Phase 2 Hardening

- `createRecoveryCode()` runs atomically via Prisma transaction (prevents multiple active codes from concurrent requests)
- `consumeAndRotate()` combines code consumption + password change + new code generation in one atomic transaction
- Partial unique index on `AdminRecoveryCode` WHERE `consumedAt IS NULL AND replacedAt IS NULL` enforces single active code at database level
- Uniform error responses prevent account enumeration on the public code generation endpoint
- `console.error` only logs stack traces, never recovery codes or plaintext credentials
- Known limitation documented: JWT sessions not invalidated after password change

Small in scope but land it early — it's the safety net that lets you walk away from support once a school is live.

## Phase 3 — Attendance ✅ Complete

Can be built in either order internally:

- **Student attendance**: class teacher marks draft → confirms (locks) → admin can override a locked record; CSV export
- **Teacher attendance**: admin marks directly, no lock

Both depend only on Phase 1 entities. No dependency between the two attendance types.

**Post-implementation integrity fix:** Added server-side validation in `POST /api/attendance` to verify that all submitted `studentId`s belong to the specified `classSectionId`. Previously, a crafted request could submit attendance for students from a different class section.

## Phase 4 — Tests, Marks, Report Cards ✅ Complete

Sequential — each step depends on the last:

1. Subject teacher creates a Test (title, date, max marks) scoped to their class+subject — **UI: `/teacher/tests` via `TestManagement` component**
2. Subject teacher enters Marks per student against that test — **UI: inline in `TestManagement` marks entry view**
3. Subject teacher creates a Term on the fly (name only, no dates) — **UI: inline in `ReportCardGeneration` component**
4. Subject teacher selects which tests count and generates a ReportCard aggregating them — **UI: `/teacher/report-cards` via `ReportCardGeneration` component with multi-select test picker**
5. Admin oversight of all tests, marks, and report cards — **UI: `/admin/tests` via `TestOverview` component, `/admin/report-cards` via `ReportCardOverview` component**
6. Academics read-only oversight of tests, marks, and report cards — **same components, read-only for ACADEMICS role**

## Phase 5 — Fee Challan ✅ Complete

- BankSettings: admin edits bank name/account number (singleton, "Fees" tab — Admin only; Academics can read but not edit)
- Certificate generation: Admin and Academics can both generate Leaving/Character certificates via UI (`/admin/certificates` — student search, type selector, generate & print action, certificate history with reprint)
- Challan generation: Admin and Academics can both generate fee challans via UI (`/admin/fees` — student search, editable line items with running total, save & print action, challan history with reprint)
- Challan history: list past challans per student, reprint from a saved snapshot (does not reflect later changes to bank settings or student class/section, by design)

Depends only on Phase 1 (Student records) — can run in parallel with Phase 4 if bandwidth allows.

## Phase 6 — Print / Visual Design Pass ✅ Complete

Print layouts for all three document types:

- **Certificate layouts** (Leaving, Character): Server-rendered printable pages at `/print/certificates/[id]`. Uses actual database data. Type-driven (LEAVING vs CHARACTER) from the `Certificate.type` field.
- **Fee Challan three-copy layout**: Server-rendered at `/print/fee-challans/[id]`. Renders exactly three copies (Bank Copy / Student Copy / School Copy) from a single `FeeChallan` record. Reusable `ChallanCopy` component receives `copyLabel` and `challan` props.
- **Report Card layout**: Server-rendered at `/print/report-cards/[id]`. Subject-grouped test tables with marks, aggregates, percentage, and grade. Uses actual backend data and calculation.

**School identity centralization:** All print layouts use `getSchoolSettings()` from `src/lib/school-settings.ts`, which reads school identity from the database `SchoolSettings` model. Configuration is managed through the Admin Settings UI at `/admin/settings`.

**Print isolation:** Dedicated `print` directory with its own minimal layout — no sidebar, no navigation, no dashboard chrome. Screen-only toolbar hidden via `print:hidden`. Pages are at `/print/certificates/[id]`, `/print/fee-challans/[id]`, `/print/report-cards/[id]`.

## Phase 7 — Internal UI Foundation ✅ Complete

Application shell, admin dashboard, and reusable UI primitives:

- **UI primitives**: Extracted shared `Toast` (`useToast` hook + `ToastContainer`), `ConfirmDialog`, `PageHeader`, `Badge`, and `ErrorState` components under `src/components/ui/`. Replaced duplicated inline toast/dialog patterns across all existing feature components.
- **Application shell**: Rebuilt sidebar with active-route highlighting (based on `usePathname`), mobile drawer with hamburger toggle, user account menu with sign-out, and consistent `aria-current` for accessibility.
- **Admin navigation**: Complete role-aware navigation with Dashboard, Students, Teachers, Academics, Classes, Subjects, Attendance, Report Cards, Certificates, Fees, and Settings — all wired to existing routes.
- **Admin dashboard**: Server-side rendered at `/admin/dashboard` with real database counts (students, teachers, academics, class sections, subjects) and quick-action links.
- **Page structure**: Standardized all authenticated pages with consistent `PageHeader` (title, description, actions), loading skeletons, empty states, and error states.
- **Responsive behavior**: Sidebar collapses to mobile drawer on `< md`. Content area uses responsive grid (`sm:grid-cols-2 lg:grid-cols-3`). Tables overflow horizontally on mobile. Forms stack vertically.
- **Accessibility**: All interactive elements have visible focus states (per DESIGN.md). Dialogs use `aria-modal`, `aria-labelledby`. Navigation uses `aria-current="page"`. Icons use `aria-hidden="true"`.
- **Consistent design language**: All components follow DESIGN.md tokens (square corners, 1px borders, no shadows, Inter font, 8px spacing scale, Lucide icons only).
- **Regression**: All existing pages (login, signup, recovery, settings, attendance, user management) preserved without functional changes.

## Phase 8 — Document Template System ✅ Complete

Template-based document generation replacing hardcoded print layouts:

- **Prisma schema**: `DocumentTemplate`, `TemplateField`, `TemplateTableRegion` models. `templateId` snapshot on `Certificate`, `ReportCard`, `FeeChallan`.
- **API routes**: List, upload, activate, delete templates; save/load field positions and table regions (Admin-only). Atomic field save via Prisma transaction.
- **Template management UI** (`/admin/templates`): Upload images (PNG/JPG) or PDFs (client-side conversion via pdfjs-dist), activate/deactivate per type, delete with in-use guard. Admin-only.
- **Visual editor**: Full-screen modal with background image canvas, drag-to-place single fields at percentage coordinates, add/edit/delete table regions with anchor/row-height/column-x definitions. Supports duplicate fieldKey placements (e.g. Fee Challan three copies).
- **Template renderer**: Shared `TemplateRenderer` component with render-time defensive validation of table region columns (Json field). Graceful fallback: `NoTemplateFallback` when no template exists.
- **Print view integration**: All three print views (`/print/certificates/[id]`, `/print/report-cards/[id]`, `/print/fee-challans/[id]`) check for snapshot template → active template → coded layout fallback.
- **pdfjs-dist**: Dynamic import, code-split (client-only, async chunk). PDF converted to PNG client-side before upload.
- **SRS v6**: §1.8, §1.9 rewritten for template-based generation. New §2 (Teachers) with Report Card template info. New §3 (Document Templates) covering lifecycle, field placement, table regions, three-copy challan layout.
- **Sidebar**: Templates link added to admin navigation.

**Requires:** `BLOB_READ_WRITE_TOKEN` env var for Vercel Blob storage (template image uploads).

## Phase 9 — Extended Operations ✅ Complete

Operational round on top of the completed product (SRS v10):

- **Student admission optional fields**: `grNumber` and `previousSchool` (nullable text) on Student — same optional-field pattern as Blood Group. Verified both-blank and both-filled create paths. Migration `20260823150011`.
- **Teacher Attendance — Academics parity (scope amendment)**: Academics gets full marking rights (Present/Absent/Leave + reporting/off time), documented in SRS §1.4/§1A as an explicit amendment. UI reworked to a two-step flow — Present opens a reporting-time editor, "Log Off Time" appears only after reporting is logged, Absent/Leave rows never show time inputs. Monthly summary + threshold/Late auto-derivation preserved. Verified live: Admin/Academics 201, Teacher 403, page guard for Academics 200.
- **Teacher Salary Slip**: `SalarySlip` + `SalarySlipDeduction` models; TeacherProfile salary config (`perDaySalary`, `lateDeductionType`, `lateDeductionValue`, Admin-only). `GET /api/salary-slips`, `POST /api/salary-slips/preview` (computed breakdown), `POST /api/salary-slips` (save with per-line waivers). Slip is immutable once saved — regenerating creates a new slip. Academics can generate; only Admin configures rates (verified 403 for Academics on rate fields). Math verified by hand: base = working days × per-day, Absent = full day, Late = AMOUNT or PERCENTAGE of per-day. Coded print at `/print/salary-slips/[id]` (assumption documented in SRS §1.10; `SALARY_SLIP` template type reserved). Migration `20260823151349`.
- **Responsive logo, final pass**: sign-in `size-16`/`size-14`, desktop sidebar `size-16`/`size-14`, mobile header `size-12`/`size-10`, landing header matched. Verified against the real 339KB crest.
- **Session idle timeout**: 15 minutes of inactivity (clicks/keystrokes/navigation) → session cleared client-side (NextAuth `signOut`) → redirect to `/login?expired=1` with the message "Session expired due to inactivity". Works across all three roles via the shared dashboard layout. Verified by lowering the threshold to 5s, then restored to 15 min.
- **Landing page accuracy**: Modules section now lists only real modules (Attendance, Teacher Attendance, Tests & Marks, Report Cards, Certificates, Fee Challan, Daily Agenda, Templates, Salary Slips) — dummy Assignments/Timetables/Announcements removed.
- **Student archive ("Past Students")**: Students with historical records (attendance, marks, report cards, certificates, fee challans) cannot be hard-deleted — they are archived (`isActive: false`), preserving all linked data while freeing their Student ID / Roll Number for reuse by new students. Students with zero historical records can still be hard-deleted. Partial unique indexes on `studentId` and `(classSectionId, rollNumber)` scoped to active students only (raw SQL migration — Prisma `@unique` does not support `WHERE`). `DELETE /api/students/:id` returns `archived: true` or `deleted: true` so the UI can show the right message. `GET /api/students?status=PAST` for listing archived students. All active-workflow queries (attendance, marks, report cards, class rosters, dashboard counts) filter to `isActive: true`. UI has Active/Past Students tabs with archive/delete action per row and ConfirmDialog. Migration `20260824000000`.

## Migration Reconciliation (Post-Phase 8)

After Phase 8, the migration chain was found to be incomplete — the database schema had drifted from `schema.prisma`. Three reconciliation migrations were added:

1. **`20260820120000_add_academics_role`**: Adds `ACADEMICS` to the `Role` enum (standalone, per Postgres limitation that new enum values cannot be used in the same transaction).
2. **`20260820120001_add_template_system_and_schema_fixes`**: Adds `isActive` to `ClassTeacherAssignment` with correct backfill (marks historical assignments inactive, only most-recent per class section active); renames `generatedByAdminId` → `generatedByUserId` on `Certificate`/`FeeChallan` via `RENAME COLUMN` (data-safe); creates `DocumentTemplate`, `TemplateField`, `TemplateTableRegion` tables; adds `templateId` FK columns.
3. **`20260820130000_add_academics_profile_table`**: Creates `AcademicsProfile` table missing from the init migration.

The full chain (9 migrations) was validated with `prisma migrate reset --force` from an empty database.

**Known pre-existing issues found during verification:**
- `(print)` route group returned 404 in Next.js 16.3.1/Turbopack — fixed by renaming from route group `(print)` to literal directory `print`, making URLs resolve to `/print/certificates/[id]` etc.
- Attendance routes have `[classSectionId]` and `[id]` at the same path level, causing a Next.js conflict. Fixed by moving confirm endpoint to `/api/attendance/confirm` with query params.
- Stale `.next` build cache had to be cleared after the print route rename to resolve TS2307 module resolution errors.
- **Print page template lookups must be wrapped in try/catch** — each Prisma call (certificate query, school settings, template lookup) is a separate DB connection that can fail independently (Neon cold start). The initial fix wrapped only the first two queries; the template lookups at lines 70–83 were unprotected and crashed the page. All three print pages (certificates, fee-challans, report-cards) were affected. Fixed in commit `f0e28c2`.

## Not in Any Phase (explicitly out of scope for SRS v5)

Assignments/Submissions, Timetables, Announcements, Notifications/messaging, OAuth or email-based password reset, Library module. Do not add these without a new SRS discussion first.
