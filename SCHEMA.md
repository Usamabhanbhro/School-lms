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

**No email delivery.** Recovery is entirely self-service via offline recovery codes. The application does NOT send recovery codes by email, SMS, or any other channel. The Admin must store the code securely themselves.

### Recovery Lifecycle

1. **Signup:** Admin account is created → recovery code generated → plaintext displayed once → only bcrypt hash stored in DB → code valid until used or manually regenerated
2. **Replacement:** If code expires/is consumed → Admin requests new code via `POST /api/admin/recover/code` (public) → previous code invalidated → new code displayed once
3. **Password Reset:** Admin submits recovery code + new password → old code consumed atomically → password changed → fresh recovery code generated and displayed once
4. **Manual Rotation:** Admin can rotate their recovery code at any time via `POST /api/admin/recovery-code/regenerate` (authenticated)

### Key Properties

- **Single active code:** At most one recovery code is valid per Admin at any time. Enforced at both application level (transactional `createRecoveryCode()`) and database level (partial unique index on `AdminRecoveryCode` WHERE `consumedAt IS NULL AND replacedAt IS NULL`)
- **No time-based expiry:** Codes remain valid indefinitely until either (a) used successfully (consumed on password reset), or (b) manually regenerated from the Admin panel. The `expiresAt` column in the database is deprecated and not read.
- **Single-use:** Consumed atomically on successful password reset. Cannot be reused.
- **Only hashes stored:** Plaintext recovery codes exist only briefly during generation, in the API response, and in the browser UI until the user leaves. Never persisted in DB, logs, cookies, localStorage, sessionStorage, or URL parameters.
- **Cryptographically secure:** Codes are 64 hex characters (256 bits of entropy) generated via `crypto.randomBytes()`.
- **Atomic operations:** All code lifecycle operations (create, consume, replace) run in Prisma transactions to prevent race conditions.
- **Rate limited:** Public endpoints (`/api/admin/recover`, `/api/admin/recover/code`) are rate limited (see Rate Limits below).

### Rate Limits

| Endpoint | Limit | Window | Scope |
|---|---|---|---|
| `POST /api/admin/recover` | 5 attempts | 15 minutes | Per IP |
| `POST /api/admin/recover/code` | 3 attempts | 15 minutes | Per IP |
| `POST /api/admin/signup` | 3 attempts | 15 minutes | Per IP |

**Limitation:** Rate limiting is in-memory (per serverless function instance). On Vercel, each serverless function invocation has its own memory, so rate limits apply within a single function but not across multiple concurrent instances. This is documented transparently rather than pretending it provides distributed protection.

### JWT Session Limitation

Existing JWT-based sessions are **not** invalidated after a password change or recovery code use. The old password can no longer authenticate, but any session token that was issued before the password change remains valid until it expires (NextAuth JWT default: 30 days). This is a known limitation of JWT-based auth without a token blocklist. Implementing session revocation would require a significant authentication rewrite (e.g., adding a token blocklist or switching to database sessions) and is not justified for a single-admin MVP.

### AdminRecoveryCode

One-time recovery codes for Admin self-service password recovery. Many historical records per Admin; only one active code at a time.
- Fields: `userId`, `codeHash` (bcrypt), `expiresAt` (deprecated — no longer enforced; column remains for migration compatibility), `consumedAt` (nullable), `replacedAt` (nullable)
- A code is active only if: `consumedAt IS NULL AND replacedAt IS NULL` — no time-based expiry
- Database constraint: partial unique index on `userId` WHERE `consumedAt IS NULL AND replacedAt IS NULL` prevents multiple active codes
- Generating a new code sets `replacedAt` on the prior active code (within a transaction)
- Consuming a code sets `consumedAt` (within the same transaction as the password change)
- `User.recoveryCodeHash` is kept in sync for quick lookup during verification
- Plaintext codes are never stored, logged, or returned after generation

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
