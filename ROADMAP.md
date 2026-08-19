# School LMS — Implementation Roadmap

Build order for reconciling and implementing the SRS (v5). Each phase unlocks the next — don't skip ahead, since later phases read data/patterns established earlier.

**Status: Phases 0–6 implemented and verified. Admin provisioning, school settings, and hardened admin self-recovery added. See `API.md` for per-route status.**

## Phase 0 — Reconciliation ✅ Complete

The existing skeleton was built against an earlier four-role assumption (Admin/Teacher/Student/Parent). Before any new feature work:

- Remove `/student` and `/parent` routes and their placeholder shells
- Rewrite `prisma/schema.prisma` from scratch to match `SCHEMA.md` (current models: `User`, `TeacherProfile`, `AcademicsProfile`, `ClassSection`, `Subject`, `ClassTeacherAssignment`, `SubjectTeacherAssignment`, `Student`, `StudentAttendance`, `TeacherAttendance`, `Test`, `Mark`, `Term`, `ReportCard`, `ReportCardTest`, `Certificate`, `BankSettings`, `FeeChallan`, `FeeChallanLineItem`)
- Three-role enum: `ADMIN`, `TEACHER`, `ACADEMICS`
- Run a fresh migration; the old migration history tied to the four-role schema should not carry forward
- Decide whether `/api/users` (the existing RBAC reference route) becomes `/api/teachers` or stays as a pattern reference only — see `API.md`

This is cleanup, not new functionality. Nothing in later phases should be built on top of the stale model.

## Phase 1 — Core Entities (no workflows yet) ✅ Complete

Admin-only CRUD, no attendance/marks/challans yet:

- Teacher: create (with CNIC/phone format validation), edit, delete, revoke, admin-driven password reset
- Academics: create (with CNIC/phone format validation), edit, delete, revoke, admin-driven password reset (same CRUD pattern as Teacher)
- ClassSection: create/edit
- Subject: create/edit
- ClassTeacherAssignment: assign/reassign the one class teacher per class (deactivate old on reassignment, never two active)
- SubjectTeacherAssignment: assign teachers to class+subject combinations
- Student: create/edit, allot to class+section (name, guardian name, guardian CNIC, DOB, admission date)

Everything downstream reads from this layer, so get the RBAC scoping right here first — Teacher views should already correctly filter to "my assigned classes only" even before there's attendance/marks data to show.

## Phase 2 — Auth Completeness ✅ Complete

- Admin recovery code: generate + display once at initial admin setup, stored via `AdminRecoveryCode` model with 24-hour expiration
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

1. Subject teacher creates a Test (title, date, max marks) scoped to their class+subject
2. Subject teacher enters Marks per student against that test
3. Subject teacher creates a Term on the fly (name only, no dates)
4. Subject teacher selects which tests count and generates a ReportCard aggregating them

## Phase 5 — Fee Challan ✅ Complete

- BankSettings: admin edits bank name/account number (singleton, "Fees" tab — Admin only; Academics can read but not edit)
- Certificate generation: Admin and Academics can both generate Leaving/Character certificates
- Challan generation: Admin and Academics can both generate fee challans — select a student, edit fee line items (base + arrears/late fee/etc.), click Print to snapshot and save
- Challan history: list past challans per student, reprint from a saved snapshot (does not reflect later changes to bank settings or student class/section, by design)

Depends only on Phase 1 (Student records) — can run in parallel with Phase 4 if bandwidth allows.

## Phase 6 — Print / Visual Design Pass ✅ Complete

Print layouts for all three document types:

- **Certificate layouts** (Leaving, Character): Server-rendered printable pages at `/print/certificates/[id]`. Uses actual database data. Type-driven (LEAVING vs CHARACTER) from the `Certificate.type` field.
- **Fee Challan three-copy layout**: Server-rendered at `/print/fee-challans/[id]`. Renders exactly three copies (Bank Copy / Student Copy / School Copy) from a single `FeeChallan` record. Reusable `ChallanCopy` component receives `copyLabel` and `challan` props.
- **Report Card layout**: Server-rendered at `/print/report-cards/[id]`. Subject-grouped test tables with marks, aggregates, percentage, and grade. Uses actual backend data and calculation.

**School identity centralization:** All print layouts use `getSchoolSettings()` from `src/lib/school-settings.ts`, which reads school identity from the database `SchoolSettings` model. Configuration is managed through the Admin Settings UI at `/admin/settings`.

**Print isolation:** Dedicated `(print)` route group with its own minimal layout — no sidebar, no navigation, no dashboard chrome. Screen-only toolbar hidden via `print:hidden`.

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

## Not in Any Phase (explicitly out of scope for SRS v5)

Assignments/Submissions, Timetables, Announcements, Notifications/messaging, OAuth or email-based password reset, Library module. Do not add these without a new SRS discussion first.
