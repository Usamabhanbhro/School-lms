# School LMS — Implementation Roadmap

Build order for reconciling and implementing the SRS (v5). Each phase unlocks the next — don't skip ahead, since later phases read data/patterns established earlier.

**Status: Phases 0–15 implemented and verified. Phases 0–14 cover core features through future-date validation. Phase 15 is the first phase of a two-phase comprehensive motion pass (high-traffic screens). LMS-side licensing remains intentionally skipped. See `API.md` for per-route status.**

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
- **Admin dashboard**: Server-side rendered at `/admin/dashboard` with real database counts (students, teachers, academics, class sections, subjects), live Needs Attention signals for incomplete attendance, unassigned Class Teachers, incomplete salary setup, and unconfirmed drafts, plus quick-action links.
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

## Phase 10 — Fee Ledger with Partial Payments ✅ Complete

- Added `FeeChallanPayment` as a separate append-only record linked to immutable challans.
- Derive payment status and outstanding balance at read time; never store a redundant status field.
- Added Admin/Academics payment history and recording controls to the Fee Challan flow, including loading feedback and color-plus-icon status badges.
- Added the school-wide Admin/Academics Fee Ledger with class, student, date-range, and status filters.
- Real Admin E2E evidence against Neon created a Rs. 12,000 challan with two line items, recorded Rs. 3,000 then Rs. 9,000, verified Pending → Partial (Rs. 9,000 balance) → Paid (Rs. 0 balance), confirmed two payment records in challan and student history, verified the Paid ledger row and Rs. 12,000 collected total, rejected an additional payment with `PAYMENT_EXCEEDS_BALANCE` (HTTP 400), and confirmed the challan total and two line items remained unchanged. Authenticated screenshots were captured for the Fee Challan payment history and school-wide ledger.

## Phase 11 — Regression Fixes and Backup Export

### Regression fixes ✅ Complete

- **Teacher Attendance Present action:** The real post-reset reproduction showed the click handler ran but no request fired because the reporting-time editor was rendered only when an already-saved record was `PRESENT` or `LATE`. The editor now renders whenever the Present action opens it. Fresh Teacher data was used; the reporting-time save returned HTTP 201, the UI showed `Reported 9:55 AM`, the persisted record reloaded as `LATE` with the saved reporting time, and the browser recorded no console errors.
- **Salary Slip future dates:** Both `From` and `To` period inputs now use a today `max` value. The earlier real browser check attempted tomorrow’s date and confirmed native `rangeOverflow: true` and `valid: false`. The current future-date validation correction also enforces the same boundary in the preview and save APIs.

### Backup export ✅ Complete

- SRS, schema, API, architecture, README, and this roadmap document an Admin-only `GET /api/backup/export` returning a single lossless JSON attachment.
- Implemented the stateless read-only route with `schemaVersion`, `exportedAt`, complete application-model data, relationship keys, and explicit exclusion of password hashes, recovery-code hashes, session tokens, and other authentication secrets. Settings exposes the download action only to Admin with loading feedback and attachment handling.
- Real browser verification triggered an actual download named `school-lms-backup-2026-08-24.json`, parsed 5,887 bytes of JSON, confirmed live users, teachers, student, attendance, FeeChallanPayment, salary, and other model data were present, confirmed `containsAuthSecrets: false`, verified the Admin response headers, and verified a Teacher receives HTTP 403 `FORBIDDEN`.

## Phase 12 — Scoped Global Search ✅ Complete

- Added one shared **Search school data** entry point to the Admin and Academics dashboard shell. Teachers intentionally do not receive the school-wide trigger and continue using assignment-scoped workflows.
- Added `GET /api/search?q=...` with server-enforced role and active-record scoping. Admin and Academics can search active Students, active Teachers, Class/Section records, Subjects, Fee Challans, and Tests; Admin additionally receives Daily Agenda matches.
- The overlay provides keyboard focus, `/` and Cmd/Ctrl+K opening, Escape and backdrop close, debounced requests, result-type labels, destination links, loading, error, empty, and short-query states.
- Real browser evidence: Admin search for `Ledger` returned the live Student, Class, and Fee Challan records with real entity labels and links; Admin search for `Regression` returned the live Teacher record; the overlay screenshot showed all three mixed results; the Teacher dashboard had zero search triggers and the same endpoint returned HTTP 403 `FORBIDDEN`.

## Phase 13 — Design-System Completion and Screenshot Verification ✅ Complete

- Preserved the locked industrial/minimal direction: existing colors, fonts, square corners, 1px borders, Lucide icons, and restrained motion. LMS-side licensing is intentionally skipped by the current product decision.
- Strengthened shared and custom interactive surfaces across lists, tables, forms, navigation, dropdowns, dialogs, and state treatments. Shared buttons and inputs now provide subtle motion and focus feedback; password visibility toggles are keyboard reachable; StudentPicker options and expandable list rows have visible focus/hover states; table rows respond to focus within; toast dismissal uses a neutral Lucide close affordance; and the template manager’s main list/editor controls use design tokens and responsive wrapping.
- Added token-based browser-surface styling for selection, caret, scrollbars, and reduced-motion behavior without changing DESIGN.md’s palette or typography.
- Final real browser evidence captured six states: populated Students list row focus, Teacher Attendance Log Off Time editor, Fee Ledger filter focus with a real Paid row, Admin user dropdown open, mobile navigation drawer open, and Templates instructional empty/list state. No browser console errors were recorded in the final batch.
- Validation passed: `bun run typecheck`, production `bun run build`, `git diff --check`, and the one-time UI detector returned an empty findings array for the changed design-system surfaces.

## Phase 14 — Future-Date Validation Correction ✅ Complete

- Audited every date input and date-validation path, classifying historical/data-entry dates separately from reporting filters and intentionally future-datable records. The explicit product rule supersedes the earlier Daily Agenda assumption: agenda entries are current-day only; past entries are locked and future entries are rejected.
- Capped Fee Ledger Issued From/To, Admin and Teacher Daily Agenda dates, Teacher Attendance dates/month filters, Salary Slip periods, fee-payment dates, and existing Student, Student Attendance, Student DOB/admission, and Test historical controls at the current Asia/Karachi local date where appropriate. Fee Ledger and other reporting filters are also server-protected where the requirement calls for historical-only filtering.
- Added shared date-only/local-today checks and server-side future/range rejection for Fee Ledger, Fee Payments, Daily Agenda, Teacher Attendance, Student Attendance, Salary Slip preview/save, Student DOB/admission create/edit, and Test creation. FeeChallan issuance remains server-generated.
- Real authenticated browser/API verification on 2026-08-24 confirmed native future invalidity on all targeted Admin controls and Teacher Agenda, HTTP 400 `DATE_IN_FUTURE`/`INVALID_DATE_RANGE` on the protected future/inverted probes, HTTP 200 current-day reads, HTTP 201 current-day Teacher Agenda creation, preservation of the paid Ledger verification row, zero probe payments, temporary-fixture cleanup, `bun run typecheck`, `bun run build`, and `git diff --check`.

## Phase 15 — Comprehensive End-to-End Audit ✅ Complete

- Audited the full public, Admin, Academics, Teacher, print, API, loading, error, responsive, accessibility, and motion surface inventory against the repository requirements and design system. Temporary role and workflow fixtures were isolated, tracked, and removed in FK-safe order; protected verification fixtures remained intact.
- Fixed AUTH-01: `/admin/academics` now permits Admin and Academics access while preserving denial for other roles. Live Admin navigation returned HTTP 200 and rendered the Academics Dashboard; unauthenticated navigation still redirected to `/login`.
- Fixed A11Y-01: the shared `StudentPicker` now applies an optional control ID to its rendered input/select. Certificate, Fee Challan, and Report Card labels now reference the actual control; live Certificate and Fee Challan DOM checks passed, and a repository-wide literal `htmlFor` scan found no unresolved associations.
- Closed remaining date-filter API gaps in Student Attendance CSV export, Teacher Attendance export, Attendance confirmation/audit filters, and Salary Slip list filters. Current-day queries remained successful while future, malformed, and inverted probes returned the documented validation codes.
- End-to-end workflow evidence covered attendance draft/confirm/lock/admin override/audit/export, tests/marks/terms/report cards, fees/payments/ledger/print, salary derivation/waivers/print, Daily Agenda, search, backup secrecy, student archive/delete, certificates/print, and Bank Settings validation. Responsive checks at desktop, tablet, and mobile widths found no horizontal overflow; motion and reduced-motion checks found no defect.
- Final audit limitation: the optional Mobbin pattern reference was unavailable on the configured plan, so the repository’s authoritative `DESIGN.md` was used for visual evaluation.

## Migration Reconciliation (Post-Phase 8)

After Phase 8, the migration chain was found to be incomplete — the database schema had drifted from `schema.prisma`. Four reconciliation and maintenance migrations were added:

1. **`20260820120000_add_academics_role`**: Adds `ACADEMICS` to the `Role` enum (standalone, per Postgres limitation that new enum values cannot be used in the same transaction).
2. **`20260820120001_add_template_system_and_schema_fixes`**: Adds `isActive` to `ClassTeacherAssignment` with correct backfill (marks historical assignments inactive, only most-recent per class section active); renames `generatedByAdminId` → `generatedByUserId` on `Certificate`/`FeeChallan` via `RENAME COLUMN` (data-safe); creates `DocumentTemplate`, `TemplateField`, `TemplateTableRegion` tables; adds `templateId` FK columns.
3. **`20260820130000_add_academics_profile_table`**: Creates `AcademicsProfile` table missing from the init migration.
4. **`20260823180000_add_admin_unique_constraint`**: Reconciles the production-applied `User_admin_role_unique` partial index with repository migration history without re-executing its DDL in production. Production also retains the earlier `User_single_admin_idx`; both protect the same single-Admin invariant and are a historical duplicate, not two intentional design features.
5. **`20260824010000_fix_class_teacher_partial_unique`**: Removes the incorrect full `(classSectionId, isActive)` unique index and creates the active-only partial `ClassTeacherAssignment_active_unique` index. This was deployed after real production-backed reassignment testing reproduced `P2002`.

**Low-priority cleanup debt:** after a safe production window, a future migration can drop one of the duplicate Admin indexes following a fresh verification of the remaining constraint. Do not perform that cleanup during this reconciliation pass because the live invariant is actively protecting the single-Admin account.

The full chain (now 21 migrations) was validated with `prisma migrate reset --force` from an empty database; production reports all 21 migrations applied and up to date. The Fee Ledger migration was then deployed to Neon and `prisma migrate status` confirmed the database was up to date. The reconciliation migration was already applied live and was added locally without replaying its DDL.

**Known pre-existing issues found during verification:**
- `(print)` route group returned 404 in Next.js 16.3.1/Turbopack — fixed by renaming from route group `(print)` to literal directory `print`, making URLs resolve to `/print/certificates/[id]` etc.
- Attendance routes have `[classSectionId]` and `[id]` at the same path level, causing a Next.js conflict. Fixed by moving confirm endpoint to `/api/attendance/confirm` with query params.
- Stale `.next` build cache had to be cleared after the print route rename to resolve TS2307 module resolution errors.
- **Print page template lookups must be wrapped in try/catch** — each Prisma call (certificate query, school settings, template lookup) is a separate DB connection that can fail independently (Neon cold start). The initial fix wrapped only the first two queries; the template lookups at lines 70–83 were unprotected and crashed the page. All three print pages (certificates, fee-challans, report-cards) were affected. Fixed in commit `f0e28c2`.
- **Class Teacher reassignment invariant**: Production testing reproduced `P2002` from the full `(classSectionId, isActive)` unique index. Migration `20260824010000_fix_class_teacher_partial_unique` replaced it with the active-only partial index; reassignment, multi-history preservation, and restoration were verified against Neon.
- **Reliability hardening**: Protected API handlers were probed for the standard `{ error: { message, code } }` shape; client surfaces now preserve specific API errors, reset loading state in `finally`, and expose an actionable zero-assignment Teacher Agenda empty state.
- **Admin Dashboard Needs Attention**: `/admin/dashboard` now computes live operational signals from active records only and links each item to the relevant workflow. The section has an explicit all-clear state when no signal is present.

## Phase 15 — Comprehensive Motion Pass (Phase 1 of 2) ✅ Complete

First phase of a two-phase motion audit and refinement pass, covering the four highest-traffic screens: Login, Dashboard, Attendance (student + teacher), and Students.

**Changes applied:**

- **Login page entry animation**: Added `MountAnimation` wrapper (200ms ease-out fade-in + slide-up) to the login page, matching the existing dashboard mount transition pattern.
- **Skeleton shimmer sweep**: Replaced generic `animate-pulse` with a left-to-right shimmer sweep (`shimmer` keyframe, 1600ms loop) across all Skeleton usages. The shimmer uses a subtle semi-transparent gradient rather than an opacity pulse, matching the DESIGN.md spec of "~1.4–1.8s loop". Verified on all four screens' loading states.
- **Login button spinner**: Added `Loader2` spinner icon during form submission (previously only changed button text). Confirmed spinner resets on both success and error paths via `finally` block.
- **Toast entrance animation**: Added `toast-slide-in` (200ms ease-out, `translateX(100%) → translateX(0)`) toasts so they slide in from the right rather than appearing instantly. Progress bar + dismiss button already existed and remain unchanged.
- **Monthly totals panel slide**: Teacher attendance "Show Monthly Totals" panel now uses `dialog-scale-in` (200ms ease-out) when opening, matching the modal timing family.
- **Status change flash**: Admin student attendance status badges now flash briefly (`status-flash`, 400ms ease-out) when a status is overridden via the optimistic update, using React `key` prop forcing re-render on status change.

**Already present (confirmed, not changed):**
- Dashboard mount animation via `MountAnimation` in layout — all four screens inherit this.
- `ConfirmDialog` open/close transitions (`overlay-fade-in` 150ms + `dialog-scale-in` 200ms) — already applied to attendance lock and student archive/delete dialogs.
- Table row hover states (`transition-colors duration-150 ease-out hover:bg-surface/60`) on `TR` component — already present across all tables.
- Toast progress bar animation (`toast-progress` keyframe, 4000ms linear drain) — already present.
- Button spinners (`Loader2 animate-spin`) on submit buttons in Attendance and Students — already present and correctly resetting on all paths.
- `prefers-reduced-motion` global rule sets `animation-duration: 0.01ms` — all new animations inherit this automatically.

**Phase 2 (follow-up):** Covers the remaining ~11 modules (Certificates, Fees, Templates, Report Cards, Tests, Settings, Salary Slips, Daily Agenda, Fee Ledger, Academics dashboard, Teacher dashboard). Not covered in this phase.

## Not in Any Phase (explicitly out of scope for SRS v5)

Assignments/Submissions, Timetables, Announcements, Notifications/messaging, OAuth or email-based password reset, Library module. Do not add these without a new SRS discussion first.
