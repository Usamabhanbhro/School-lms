# School LMS — Implementation Roadmap

Build order for reconciling and implementing the SRS (v5). Each phase unlocks the next — don't skip ahead, since later phases read data/patterns established earlier.

**Status: Phases 0–5 implemented and verified (see `API.md` for per-route status). Phase 6 (print layouts) is the only remaining functional work, plus rate limiting on `/api/admin/recover` — see `README.md` Remaining Work.**

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

- Admin recovery code: generate + display once at initial admin setup, hash-only storage
- `POST /api/admin/recover`: verify code, set new password, rotate to a new code
- Manual regenerate-code action from within the admin panel
- Rate limiting on the public recovery route (see `API.md` Not Yet Scoped)

Small in scope but land it early — it's the safety net that lets you walk away from support once a school is live.

## Phase 3 — Attendance ✅ Complete

Can be built in either order internally:

- **Student attendance**: class teacher marks draft → confirms (locks) → admin can override a locked record; CSV export
- **Teacher attendance**: admin marks directly, no lock

Both depend only on Phase 1 entities. No dependency between the two attendance types.

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

## Phase 6 — Print / Visual Design Pass 🔲 Not started

Deliberately last — these three are functionally specified but visually undesigned, and designing print stylesheets before the underlying data flows exist means designing blind:

- Certificate layouts (Leaving, Character)
- Fee Challan three-copy layout (Bank Copy / Student Copy / School Copy, prominently labeled, one page)
- Report Card layout

Use `DESIGN.md`'s print stylesheet guidance as the starting point for all three.

## Not in Any Phase (explicitly out of scope for SRS v5)

Assignments/Submissions, Timetables, Announcements, Notifications/messaging, OAuth or email-based password reset, Library module. Do not add these without a new SRS discussion first.
