# School LMS — Database Schema

Plain-English companion to `prisma/schema.prisma`. Every model in Prisma should have a matching entry here explaining *why* it exists and how it relates to others.

**Status: reconciled with SRS.md v5.** Three login roles: Admin (single account), Academics (multiple), and Teacher (multiple). Students are data records, not logins. No Parent access.

## Conventions

- Primary keys: `id` (cuid)
- Foreign keys: `<entity>Id` (e.g. `studentId`, `classSectionId`)
- Timestamps: every model gets `createdAt` and `updatedAt`
- Soft delete via `isActive` flag for anything with historical records attached (Teacher, Student) — never hard-delete rows that attendance/marks/certificates reference
- Enums over free-text strings for fixed sets: `Role`, `AttendanceStatus`, `CertificateType`

## Models

### User
Login identity. Exactly one row with `role = ADMIN` should ever exist (enforced at application level, not a DB constraint — flag if a hard constraint is wanted later). Multiple rows with `role = TEACHER` or `role = ACADEMICS`.
- Fields: `username` or `email`, `passwordHash`, `role` (enum: `ADMIN`, `TEACHER`, `ACADEMICS`), `isActive`
- Admin-only: `recoveryCodeHash` — hash of the current one-time recovery code (see Admin Password Recovery below). Null for Teacher/Academics rows.
- Relationships: one-to-one with `TeacherProfile` if `role = TEACHER`; one-to-one with `AcademicsProfile` if `role = ACADEMICS`

### TeacherProfile
Teacher-specific fields, kept separate from `User` so `User` stays a clean auth/identity table.
- Fields: `name`, `fatherOrSpouseName`, `cnic` (format `xxxxx-xxxxxxx-x`, validated), `phone` (format `03xx-xxxxxxx`, validated), `email`
- Relationships: belongs to one `User`; has many `ClassTeacherAssignment`, many `SubjectTeacherAssignment`, many `TeacherAttendance` records (as the subject)

### AcademicsProfile
Academics-specific fields, kept separate from `User` (mirrors `TeacherProfile` pattern).
- Fields: `name`, `cnic` (format `xxxxx-xxxxxxx-x`, validated), `phone` (format `03xx-xxxxxxx`, validated), `email`
- Relationships: belongs to one `User`

### ClassSection
A specific class + section (e.g. "Grade 5 - A"). Created by Admin.
- Fields: `className` (e.g. "Grade 5"), `sectionName` (e.g. "A")
- Relationships: has many `Student` (enrolled), has one `ClassTeacherAssignment` (at most one active class teacher at a time), has many `SubjectTeacherAssignment`

### Subject
Created by Admin (e.g. "Mathematics"). Global to the school, not per-class — a `SubjectTeacherAssignment` is what ties a Subject to a specific ClassSection + Teacher.
- Fields: `name`

### ClassTeacherAssignment
Tracks class teacher assignments over time. Only one row per ClassSection should have `isActive = true` at any time. Reassigning soft-deletes the old (sets `isActive = false`) and creates a new active row.
- Fields: `classSectionId`, `teacherId`, `isActive` (default: true)
- Constraint: `@@unique([classSectionId, isActive])` — only one active assignment per ClassSection

### SubjectTeacherAssignment
A teacher assigned to teach one Subject within one ClassSection — holds rights to create tests, enter marks, and generate report cards for that subject/class.
- Fields: `classSectionId`, `subjectId`, `teacherId`
- A teacher can hold many of these across different classes/subjects; a ClassSection can have many (one per subject, generally)

### Student
Created by Admin, allotted to a ClassSection. **Not a login** — pure data record.
- Fields: `name`, `guardianName` (father/guardian), `guardianCnic` (format `xxxxx-xxxxxxx-x`), `dateOfBirth`, `admissionDate`, `classSectionId`
- No CNIC field for the student themselves (confirmed in SRS)
- Relationships: has many `StudentAttendance`, many `Mark`, many `ReportCard`, many `Certificate`, many `FeeChallan`

### StudentAttendance
One record per student per class per day. Only the ClassSection's active Class Teacher can create/edit these (pre-lock).
- Fields: `studentId`, `classSectionId`, `date`, `status` (enum: `PRESENT`, `ABSENT`, `LEAVE`), `isConfirmed` (draft vs locked), `markedByTeacherId`, `lastEditedByAdmin` (nullable — set if Admin overrides a locked record, per SRS 1.5)
- Index on `(classSectionId, date)` at minimum — this is the highest-traffic table
- Business rule enforced at API level, not just UI: once `isConfirmed = true`, only a request from the Admin role may modify the row

### TeacherAttendance
One record per teacher per day, marked directly by Admin — no draft/confirm lock (Admin already has full edit rights).
- Fields: `teacherId`, `date`, `status` (enum: `PRESENT`, `ABSENT`, `LEAVE`)

### Test
Created by a Subject Teacher, scoped to one ClassSection + Subject.
- Fields: `classSectionId`, `subjectId`, `teacherId`, `title`, `date`, `maxMarks`

### Mark
A student's score on a specific Test.
- Fields: `testId`, `studentId`, `marksObtained`
- Store as numeric, not string, to support tabular-figure display per DESIGN.md

### Term
A flexible, freely-named label (e.g. "Mid Term", "Term 1") — **not** a fixed calendar period. Created on the fly by a teacher at report-card-generation time.
- Fields: `name`, `createdByTeacherId`

### ReportCard
Aggregates a teacher-selected subset of Tests into one report for a student, tagged with a Term.
- Fields: `studentId`, `classSectionId`, `termId`, `generatedByTeacherId`
- Relationship: many-to-many with `Test` via a join table (`ReportCardTest`) recording which tests were included in this particular aggregate

### Certificate — design deferred
Generated by Admin or Academics, per student. Layout/fields not finalized (see SRS §1.8, §1A.1).
- Fields (anticipated, not final): `studentId`, `type` (enum: `LEAVING`, `CHARACTER`), `generatedByUserId` (Admin or Academics), `issuedDate`

### BankSettings
School-wide singleton, editable by **Admin only** in the "Fees" tab. Academics can read bank settings (for challan generation) but cannot edit them. Only one row should exist.
- Fields: `bankName`, `bankAccountNumber`

### FeeChallan
Generated by Admin or Academics for one Student. **Snapshots** bank details and student details at generation time (not live references) so a challan remains historically accurate even if bank info or the student's class/section changes later. Immutable once saved — regenerating creates a new challan.
- Fields: `studentId`, `studentNameSnapshot`, `guardianNameSnapshot`, `guardianCnicSnapshot`, `classSectionSnapshot` (e.g. "Grade 5 - A" as text, not a live FK, for the same historical-accuracy reason), `bankNameSnapshot`, `bankAccountNumberSnapshot`, `generatedByUserId` (Admin or Academics), `issuedDate`, `total` (computed, sum of line items)
- Relationships: has many `FeeChallanLineItem`

### FeeChallanLineItem
A single fee component on a challan — base fee, arrears, late fee, or any admin-defined line.
- Fields: `feeChallanId`, `description`, `amount`

**Print structure:** not a separate model — the print view renders the same `FeeChallan` + line items **three times on one page** (Bank Copy / Student Copy / School Copy), each prominently labeled. This is a print-stylesheet concern (see DESIGN.md), not a data-model concern.

## Admin Password Recovery

Not a separate model — implemented as fields on `User` (Admin row only):
- `recoveryCodeHash` — hash of the current valid one-time recovery code
- On successful use via `/admin/recover`, the code is invalidated and a new one generated and shown once (never stored in plaintext, never logged)

### SchoolSettings

School-wide singleton for identity configuration. Admin edits these through the Settings UI at `/admin/settings`. Only one row should exist — enforced at application level, not a DB constraint.
- Fields: `schoolName`, `address`, `phone`, `email`, `principalName`, `logoPath` (nullable — relative path to uploaded logo)
- Read by `getSchoolSettings()` in `src/lib/school-settings.ts` — used by all print layouts and the print preview header
- On a fresh deployment, default placeholder values are used until the Admin configures them

## Not Yet Modeled

- Certificate and Report Card print templates, and the Fee Challan three-copy print layout (functional data models exist; visual layouts do not)

## Migration Notes

- Use Prisma Migrate (`bun run db:migrate` locally, `bun run db:deploy` in production)
- Every migration should have a one-line comment explaining the "why," matching the corresponding update to this file
