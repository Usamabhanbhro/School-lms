# School LMS — Database Schema

Plain-English companion to `prisma/schema.prisma`. Every model in Prisma should have a matching entry here explaining *why* it exists and how it relates to others.

**Status: reconciled with SRS.md v14.** Three login roles: Admin (single account), Academics (multiple), and Teacher (multiple). Students are data records, not logins. No Parent access.

## Conventions

- Primary keys: `id` (cuid)
- Foreign keys: `<entity>Id` (e.g. `studentId`, `classSectionId`)
- Timestamps: every model gets `createdAt` and `updatedAt`
- Soft delete via `isActive` flag for anything with historical records attached (Teacher, Student) — never hard-delete rows that attendance/marks/certificates reference
- Enums over free-text strings for fixed sets: `Role`, `AttendanceStatus`, `CertificateType`, `BloodGroup`

## Models

### User
Login identity. Exactly one row with `role = ADMIN` should ever exist (enforced at application level, not a DB constraint — flag if a hard constraint is wanted later). Multiple rows with `role = TEACHER` or `role = ACADEMICS`.
- Fields: `username` or `email`, `passwordHash`, `role` (enum: `ADMIN`, `TEACHER`, `ACADEMICS`), `isActive`
- Admin-only: `recoveryCodeHash` — hash of the current one-time recovery code (see Admin Password Recovery below). Null for Teacher/Academics rows.
- Relationships: one-to-one with `TeacherProfile` if `role = TEACHER`; one-to-one with `AcademicsProfile` if `role = ACADEMICS`

### TeacherProfile
Teacher-specific fields, kept separate from `User` so `User` stays a clean auth/identity table.
- Fields: `name`, `fatherOrSpouseName`, `cnic` (format `xxxxx-xxxxxxx-x`, validated), `phone` (format `03xx-xxxxxxx`, validated), `email`
- **Schedule fields** (all nullable text, stored as `HH:MM:SS` strings):
  - `reportingTime` — expected arrival time
  - `offTime` — expected departure time
  - `lateThreshold` — arrival time after which the teacher is auto-marked Late
- **Salary config fields** (all nullable; set by Admin only, used by Salary Slip generation):
  - `perDaySalary` (Int) — daily pay in PKR
  - `lateDeductionType` (enum `LateDeductionType`: `AMOUNT` | `PERCENTAGE`)
  - `lateDeductionValue` (Int) — flat Rs. for `AMOUNT`, or percentage of `perDaySalary` for `PERCENTAGE`
- Relationships: belongs to one `User`; has many `ClassTeacherAssignment`, many `SubjectTeacherAssignment`, many `TeacherAttendance` records (as the subject), many `DailyAgenda` entries (as author)

### AcademicsProfile
Academics-specific fields, kept separate from `User` (mirrors `TeacherProfile` pattern).
- Fields: `name`, `cnic` (format `xxxxx-xxxxxxx-x`, validated), `phone` (format `03xx-xxxxxxx`, validated), `email`
- Relationships: belongs to one `User`

### ClassSection
A specific class + section (e.g. "Grade 5 - A"). Created by Admin.
- Fields: `className` (e.g. "Grade 5"), `sectionName` (e.g. "A")
- Relationships: has many `Student` (enrolled), has one `ClassTeacherAssignment` (at most one active class teacher at a time), has many `SubjectTeacherAssignment`, has many `DailyAgenda` entries

### Subject
Created by Admin (e.g. "Mathematics"). Global to the school, not per-class — a `SubjectTeacherAssignment` is what ties a Subject to a specific ClassSection + Teacher.
- Fields: `name`

### ClassTeacherAssignment
Tracks class teacher assignments over time. Only one row per ClassSection should have `isActive = true` at any time. Reassigning soft-deletes the old (sets `isActive = false`) and creates a new active row while preserving historical assignments.
- Fields: `classSectionId`, `teacherId`, `isActive` (default: true)
- Constraint: partial unique index `ClassTeacherAssignment_active_unique` on `classSectionId WHERE isActive = true` — only one active assignment per ClassSection while multiple inactive historical assignments remain permitted. Prisma cannot express this `WHERE` predicate as a schema attribute.

### SubjectTeacherAssignment
A teacher assigned to teach one Subject within one ClassSection — holds rights to create tests, enter marks, and generate report cards for that subject/class.
- Fields: `classSectionId`, `subjectId`, `teacherId`
- A teacher can hold many of these across different classes/subjects; a ClassSection can have many (one per subject, generally)

### BloodGroup
Enum for student blood groups: `A_PLUS`, `A_MINUS`, `B_PLUS`, `B_MINUS`, `AB_PLUS`, `AB_MINUS`, `O_PLUS`, `O_MINUS`. Used by the `Student.bloodGroup` field.

### Student
Created by Admin, allotted to a ClassSection. **Not a login** — pure data record.
- Fields: `name`, `guardianName` (father/guardian), `guardianCnic` (format `xxxxx-xxxxxxx-x`), `dateOfBirth`, `admissionDate`, `placeOfBirth` (required), `bloodGroup` (optional, enum `BloodGroup`), `guardianContact` (phone, format `03xx-xxxxxxx`), `address` (required), `classSectionId`
- `studentId` (nullable) — Admin/ACADEMICS-assigned student identifier (e.g. `STD-2026-001`). Auto-suggested on creation, editable before save. Unique among **active** students only (partial index — archived students' IDs are freed for reuse).
- `rollNumber` (nullable) — Admin/ACADEMICS-assigned roll number, unique within the class section among **active** students only (partial index — archived students' roll numbers are freed for reuse). Auto-suggested based on existing roll numbers in the class. Editable before save.
- `grNumber` (nullable text) — optional general-register / admission registration number. Free text, no validation beyond a 50-char cap. Not unique by design.
- `previousSchool` (nullable text) — optional school attended before admission. Free text, 200-char cap. Informational only.
- `isActive` (boolean, default `true`) — `true` = active (in current class roster), `false` = archived ("Past Student"). Matches the `isActive` convention used by User, TeacherProfile, etc.
- No CNIC field for the student themselves (confirmed in SRS)
- `guardianContact` reuses the same `03xx-xxxxxxx` phone validation as TeacherProfile.phone
- Relationships: has many `StudentAttendance`, many `Mark`, many `ReportCard`, many `Certificate`, many `FeeChallan`
- Constraints: partial unique indexes enforced via raw SQL in migration (Prisma `@unique` does not support `WHERE` clauses):
  - `Student_studentId_active_unique` — unique `studentId` among active students where `studentId IS NOT NULL`
  - `Student_classSection_rollNumber_active_unique` — unique `(classSectionId, rollNumber)` among active students where `rollNumber IS NOT NULL`
- Indexes: `@@index([isActive])`, `@@index([classSectionId, isActive])` for efficient filtering

### StudentAttendance
One record per student per class per day. Class Teacher can create/edit drafts. Admin and Academics can edit any record (including locked).
- Fields: `studentId`, `classSectionId`, `date`, `status` (enum: `PRESENT`, `ABSENT`, `LEAVE`), `isConfirmed` (draft vs locked), `markedByTeacherId`, `lastEditedByAdmin` (nullable — set if Admin/Academics edits a record)
- `auditLogs` — has many `AttendanceAuditLog` entries (one per edit by Admin/Academics)
- Index on `(classSectionId, date)` at minimum — this is the highest-traffic table
- Business rule enforced at API level: Teacher can only edit drafts; Admin and Academics can edit any record; every edit by Admin/Academics produces an audit log entry

### TeacherAttendance
One record per teacher per day, marked directly by Admin — no draft/confirm lock (Admin already has full edit rights).
- Fields: `teacherId`, `date`, `status` (enum: `PRESENT`, `ABSENT`, `LEAVE`, `LATE`)
- `actualReportingTime` (nullable text, e.g. `"08:25:00"`) — actual time the teacher reported, entered by Admin. Null for ABSENT/LEAVE.
- `actualOffTime` (nullable text, e.g. `"16:10:00"`) — actual off time, entered by Admin. Null for ABSENT/LEAVE.
- **Status auto-derivation**: When Admin marks a teacher PRESENT with an `actualReportingTime`, the server compares it against the teacher's configured `lateThreshold` (on TeacherProfile). If the actual time is after the threshold, the stored status automatically becomes `LATE` instead of `PRESENT`. This derivation happens server-side in the API route, not just in the UI.

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
Aggregates a teacher-selected subset of Tests into one report for a student, tagged with a Term. Print layout uses a template (see DocumentTemplate).
- Fields: `studentId`, `classSectionId`, `termId`, `generatedByTeacherId`, `templateId` (nullable — snapshot of which template version was active when generated)
- Relationship: many-to-many with `Test` via a join table (`ReportCardTest`) recording which tests were included in this particular aggregate

### Certificate
Generated by Admin or Academics, per student. Print layout uses a template (see DocumentTemplate).
- Fields: `studentId`, `type` (enum: `LEAVING`, `CHARACTER`), `generatedByUserId` (Admin or Academics), `issuedDate`, `templateId` (nullable — snapshot of which template version was active when generated)

### BankSettings
School-wide singleton, editable by **Admin only** in the "Fees" tab. Academics can read bank settings (for challan generation) but cannot edit them. Only one row should exist.
- Fields: `bankName`, `bankAccountNumber`

### FeeChallan
Generated by Admin or Academics for one Student. **Snapshots** bank details and student details at generation time (not live references) so a challan remains historically accurate even if bank info or the student's class/section changes later. Immutable once saved — regenerating creates a new challan. Print layout uses a template (see DocumentTemplate).
- Fields: `studentId`, `studentNameSnapshot`, `guardianNameSnapshot`, `guardianCnicSnapshot`, `classSectionSnapshot` (e.g. "Grade 5 - A" as text, not a live FK, for the same historical-accuracy reason), `bankNameSnapshot`, `bankAccountNumberSnapshot`, `generatedByUserId` (Admin or Academics), `issuedDate`, `total` (computed, sum of line items), `templateId` (nullable — snapshot of which template version was active when generated)
- Relationships: has many `FeeChallanLineItem`, has many `FeeChallanPayment`

### FeeChallanLineItem
A single fee component on a challan — base fee, arrears, late fee, or any admin-defined line.
- Fields: `feeChallanId`, `description`, `amount`

### FeeChallanPayment

A payment recorded against an immutable FeeChallan snapshot. Payments are append-only financial events: they do not modify the challan total, line items, bank snapshot, or student snapshot.
- Fields: `feeChallanId`, `amount` (positive integer in PKR), `paidAt` (date/time), `recordedByUserId` (Admin or Academics), `note` (optional text)
- Relationships: belongs to one `FeeChallan` and one recording `User`; deleting a challan cascades its payment history
- The server derives `paidTotal`, `balanceRemaining`, and `status` at read time from the sum of payments versus `FeeChallan.total`: `Pending` = zero paid, `Partial` = paid total below total, `Paid` = paid total equal to total. Overpayments are rejected. No redundant status column is stored, so status cannot drift from the payment history.

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

### DocumentTemplate
Visual template for document print layout. Admin uploads a background image and places fields on it. Templates are versioned — already-generated documents reference the template version that was active when created.
- Fields: `type` (enum: `LEAVING_CERTIFICATE`, `CHARACTER_CERTIFICATE`, `REPORT_CARD`, `FEE_CHALLAN`), `originalFileUrl` (URL to the uploaded original file in Vercel Blob), `backgroundImageUrl` (URL to the rendered background image — for PDFs, this is the client-side-rendered PNG; for images, same as originalFileUrl), `uploadedBy` (Admin userId), `isActive` (boolean — only one active template per type at a time)
- Relationships: has many `TemplateField`, has many `TemplateTableRegion`
- Constraint: only one template per type should have `isActive = true` (enforced at application level)

### TemplateField
A single field placement on a template. Positioned at percentage-based coordinates so the print view scales correctly regardless of screen size.
- Fields: `templateId`, `fieldKey` (string — e.g. `studentName`, `guardianName`, `classSection`), `xPercent` (0-100), `yPercent` (0-100), `fontSize` (px), `textAlign` (enum: `left`, `center`, `right`)
- Dimensions (nullable for backward compatibility): `widthPercent` (field width as % of template), `heightPercent` (field height as % of template). When null, field auto-sizes to content.
- Rich formatting (all nullable for backward compatibility): `fontFamily` (CSS font-family string), `fontColor` (CSS color — e.g. `#000000`), `fontWeight` (`normal` or `bold`), `fontStyle` (`normal` or `italic`), `textDecoration` (`none` or `underline`)
- Note: the same `fieldKey` can appear multiple times on a Fee Challan template (once per copy — Bank, Student, School)

### TemplateTableRegion
A variable-length table region on a template (used by Report Card and Fee Challan). Defines where the table starts, how tall each row is, and where each column's values go.
- Fields: `templateId`, `anchorXPercent` (0-100), `anchorYPercent` (0-100), `rowHeightPercent` (0-100 — height of each row as % of template height), `columns` (JSON array of `{ fieldKey: string, xPercent: number }`)
- The renderer lays out N rows starting at the anchor, incrementing y by `rowHeightPercent` per row

### SalarySlip
A teacher's pay slip for one date range. Generated by Admin or Academics; **immutable once saved** — regenerating for the same period creates a new slip (same pattern as FeeChallan). Snapshots the salary config at generation time so historical slips stay accurate.
- Fields: `teacherId`, `periodFrom` (date), `periodTo` (date), `perDaySalary`, `lateDeductionType`, `lateDeductionValue` (snapshot), `baseAmount` (working days × perDaySalary), `netAmount` (base − non-waived deductions), `generatedByUserId` (Admin or Academics), `issuedDate`, `templateId` (nullable — reserved for future template-based print; prints use a coded layout for now)
- Relationships: belongs to one `TeacherProfile`, one `User` (generator); has many `SalarySlipDeduction`
- Index on `(teacherId, periodFrom, periodTo)`
- **Computation rules (SRS §1.11):** Absent day → full per-day pay deducted; Late day → `lateDeductionType` AMOUNT or PERCENTAGE-of-`perDaySalary`; Leave/Present → no deduction; a day with no attendance record is not counted as a working day.

### SalarySlipDeduction
One deduction line on a slip — either a Late day or an Absent day. Only **non-waived** lines are saved (waiving happens at generation time as a per-instance decision); the `waived` column stays `false` on saved rows for historical clarity.
- Fields: `salarySlipId`, `date` (the attendance day), `type` (enum `SalarySlipDeductionType`: `LATE` | `ABSENT`), `amount`, `waived` (default false)
- Cascades with its `SalarySlip` (`onDelete: Cascade`)

### AttendanceAuditLog
Immutable audit record for ADMIN/ACADEMICS attendance edits. Every edit by Admin or Academics produces one row. Audit records must not be edited or deleted through the application.
- Fields: `studentAttendanceId` (unique — one audit log per edit), `editedById` (the user who made the change), `editedByRole` (ADMIN or ACADEMICS), `previousStatus`, `newStatus`, `createdAt`
- Relationships: belongs to one `StudentAttendance`, belongs to one `User` (editor)
- Constraints: `@@unique([studentAttendanceId])` — one audit entry per edit; `@@index([studentAttendanceId])` for efficient queries
- Access: ADMIN only can view audit history. ACADEMICS can edit attendance but must NOT view audit history. Teachers cannot view or edit audit logs.

### DailyAgenda
Per-teacher, per-class+subject, per-day lesson log. Teachers write entries for their assigned subjects; Admin has read-only visibility. Academics has no access.
- Fields: `teacherId` (FK to TeacherProfile), `classSectionId` (FK to ClassSection), `subjectId` (FK to Subject), `date` (date only, not datetime), `content` (text, up to 5000 chars), `createdAt`, `updatedAt`
- Relationships: belongs to one TeacherProfile, one ClassSection, one Subject
- Constraint: `@@unique([teacherId, classSectionId, subjectId, date])` — one entry per teacher per class+subject per day; writing again for an existing date updates, not duplicates
- Locking: no stored lock flag. Server-side check compares `date` against current date using `Asia/Karoshi` (PKT) timezone via `getTodayLocal()` helper. Editable if date is today or future; read-only if past.
- Permission: only the Subject Teacher assigned to the (classSectionId, subjectId) combination can create/edit — enforced via `SubjectTeacherAssignment` lookup, same as Tests
- Admin access: read-only across all teachers/classes/subjects/dates
- Academics access: explicitly excluded (see SRS §1A.2)

## Backup Export

The on-demand backup is a read-only serialization of the existing relational models; it introduces no `Backup` table, job record, or background worker. The JSON bundle includes the model rows and relationship-bearing foreign keys needed for restoration, while excluding password hashes, recovery-code hashes, session tokens, and other authentication secrets. The bundle carries `schemaVersion` and `exportedAt` metadata so future restore tooling can identify its format.

## Global Search

Global Search introduces no new model or search index. It queries the existing active Student, TeacherProfile/User, ClassSection, Subject, FeeChallan, Test, and (for Admin) DailyAgenda records. Returned result objects are transient view data containing an entity type, real record ID, title, context subtitle, and destination route. Role and active-record filtering are enforced in the API rather than represented as persisted data.

## Design-System Completion

The design-system completion pass is presentation-only. It adds no models, fields, indexes, migrations, or persisted UI state. Refinements apply to existing shared components and feature surfaces, including interactive focus/hover behavior, state visibility, responsive composition, and screenshot-verifiable interaction feedback.

## Not Yet Modeled

- None — all models documented above are implemented

## Migration Notes

- Use Prisma Migrate (`bun run db:migrate` locally, `bun run db:deploy` in production)
- Every migration should have a one-line comment explaining the "why," matching the corresponding update to this file
- **Migration `20260820120000_add_academics_role`**: Adds `ACADEMICS` to Role enum (standalone, per Postgres enum limitation)
- **Migration `20260820120001_add_template_system_and_schema_fixes`**: Reconciles schema/database drift — adds `isActive` to `ClassTeacherAssignment` with backfill (most-recent-per-class active), renames `generatedByAdminId` → `generatedByUserId` via `RENAME COLUMN` (data-safe), creates DocumentTemplate/TemplateField/TemplateTableRegion tables, adds `templateId` FK columns
- **Migration `20260820130000_add_academics_profile_table`**: Creates `AcademicsProfile` table missing from the init migration
- **Migration `20260821100000_add_student_id_roll_number_and_audit_trail`**: Adds `studentId` (unique, nullable) and `rollNumber` (nullable) to Student for Admin/ACADEMICS-assigned identifiers; creates `AttendanceAuditLog` table for immutable audit trail of attendance edits by Admin/Academics
- **Migration `20260821140000_add_template_field_rich_formatting`**: Adds `fontFamily`, `fontColor`, `fontWeight`, `fontStyle`, `textDecoration` columns to TemplateField for rich text formatting in the template editor. All nullable for backward compatibility with existing templates.
- **Migration `20260821150000_add_template_field_dimensions`**: Adds `widthPercent` and `heightPercent` columns to TemplateField for resizable fields in the template editor. Nullable for backward compatibility — null means auto-size to content.
- **Migration `20260822000000_add_daily_agenda`**: Creates DailyAgenda model for per-teacher, per-class+subject, per-day lesson logs. Unique constraint on (teacherId, classSectionId, subjectId, date). References TeacherProfile, ClassSection, Subject.
- **Migration `20260823150011_add_student_gr_number_previous_school`**: Adds nullable `grNumber` and `previousSchool` text columns to Student (optional admission fields).
- **Migration `20260823151349_add_salary_slip`**: Adds salary config fields to TeacherProfile (`perDaySalary`, `lateDeductionType`, `lateDeductionValue`), new enum values (`LateDeductionType`, `SalarySlipDeductionType`, `DocumentTemplateType.SALARY_SLIP`), and the `SalarySlip` + `SalarySlipDeduction` tables with snapshot + cascade relationships.
- **Migration `20260823180000_add_admin_unique_constraint`**: Reconciles a migration that was already applied in production but missing from the repository. It defines the canonical `User_admin_role_unique` partial unique index on `User(role) WHERE role = 'ADMIN'`; the migration SQL is idempotent and must be marked applied with Prisma resolution tooling during reconciliation rather than re-executed against the live database.
- **Migration `20260824010000_fix_class_teacher_partial_unique`**: Removes the incorrect full unique index on `(classSectionId, isActive)` and creates `ClassTeacherAssignment_active_unique` on `classSectionId WHERE isActive = true`. This preserves historical inactive assignments and fixes the real reassignment `P2002` reproduced against production.
- **Migration `20260824100000_add_fee_challan_payments`**: Adds `FeeChallanPayment` as a separate append-only payment record linked to immutable FeeChallan snapshots. It does not alter existing challan data or store a redundant status field; status and balance remain derived at read time.

  Production currently also retains `User_single_admin_idx`, created by migration `20260819000001_add_single_admin_constraint`. Both indexes enforce the same single-Admin invariant. This duplicate is a traceable historical artifact—not two separate constraints by design and not a functional bug—but it is not intentional long-term design. Do not drop either index during reconciliation; schedule a future low-risk cleanup migration after a safe production window and verification.
- **Migration `20260824000000_add_student_isActive_and_partial_unique_indexes`**: Adds `isActive` boolean (default `true`) to Student for the archive/past-students feature. Drops Prisma-managed full unique constraints on `studentId` and `(classSectionId, rollNumber)`, replacing them with partial unique indexes scoped to active students only (via raw SQL — Prisma `@unique` does not support `WHERE`). Students with historical records are archived (`isActive: false`) rather than hard-deleted; archived students' IDs/roll numbers become reusable by new students.
- The full chain (21 migrations) was validated from an empty database with `prisma migrate reset --force`; production reports all 21 migrations applied and up to date.
