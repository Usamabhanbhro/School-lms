# School LMS — API Reference

Living document. Every API route must be added here when created — see `CONVENTIONS.md` and `AGENTS.md`.

**Status: reconciled with SRS.md v15.** Three login roles: Admin, Academics, Teacher. No Student/Parent-facing endpoints.
Phase 1–6 routes are implemented. Admin provisioning, school settings, admin self-recovery, and daily agenda routes added.

## Conventions Recap

- REST-shaped, resource-based paths, plural nouns
- Auth: session-based (NextAuth), every route checks role before executing
- Success: `{ "data": ... }` — Error: `{ "error": { "message": "...", "code": "..." } }`

---

## Auth

### POST /api/auth/[...nextauth]
NextAuth handler — login/logout/session. Credentials provider only.

### POST /api/admin/signup
**Role required:** none (public route — first admin provisioning)
**Purpose:** Create the first and only Admin account. Only works when no Admin exists.
**Request body:** `{ name, email, password, confirmPassword }`
**Response (201):** `{ data: { message, userId, recoveryCode } }` — recoveryCode is the one-time plaintext code, shown once
**Notes:** Rate limited (3 attempts / 15 min / IP). Race-safe via database partial unique index. Server-side Zod validation. Recovery code is generated after user creation and its hash is stored in `AdminRecoveryCode`.
**Status:** implemented

### POST /api/admin/recover
**Role required:** none (public route — this is the recovery path for a locked-out Admin)
**Purpose:** Verify username/email + recovery code, then allow setting a new password
**Request body:** `{ usernameOrEmail, recoveryCode, newPassword }`
**Response (200):** `{ data: { message, newRecoveryCode } }` — newRecoveryCode is the fresh one-time code, shown once
**Notes:** All operations are atomic: old code consumed, password changed, new recovery code generated — all in one Prisma transaction. Rate limited (5 attempts / 15 min / IP). Generic error messages prevent account enumeration.
**Status:** implemented

### POST /api/admin/recover/code
**Role required:** none (public route — generate a new recovery code for a locked-out Admin)
**Purpose:** Generate a new recovery code when the current one has expired, been consumed, or been replaced
**Request body:** `{ usernameOrEmail }`
**Response (200):** `{ data: { message, recoveryCode } }` — recoveryCode is the one-time plaintext code
**Notes:** Returns the same generic response shape whether or not the admin exists (prevents enumeration). Rejects if an active code already exists (409). Rate limited (3 attempts / 15 min / IP). `createRecoveryCode()` runs atomically via Prisma transaction.
**Status:** implemented

### POST /api/admin/recovery-code/regenerate
**Role required:** Admin (authenticated)
**Purpose:** Manually rotate the admin's recovery code. Invalidates any prior active code, generates a new one, and returns the plaintext code once.
**Request body:** none
**Response (200):** `{ data: { message, recoveryCode } }` — recoveryCode is the one-time plaintext code
**Notes:** Uses `createRecoveryCode()` which runs atomically via Prisma transaction. Only the Admin can trigger this. No rate limiting (authenticated endpoint, admin-only).
**Status:** implemented

---

## Teachers (Admin-managed)

### GET /api/teachers
**Role required:** Admin
**Purpose:** List teachers (with profile data)
**Status:** implemented

### POST /api/teachers
**Role required:** Admin
**Purpose:** Create a teacher account (User + TeacherProfile in transaction)
**Request body:** `{ name, fatherOrSpouseName, cnic, phone, email, password, reportingTime?, offTime?, lateThreshold? }`
**Notes:** validates CNIC (`xxxxx-xxxxxxx-x`) and phone (`03xx-xxxxxxx`) formats server-side; derives username from email prefix or CNIC. Schedule fields are optional text strings (e.g. `"08:30:00"`).
**Status:** implemented

### PATCH /api/teachers/:id
**Role required:** Admin
**Purpose:** Edit teacher fields, or set `isActive: false` to revoke
**Request body:** partial `{ name, fatherOrSpouseName, cnic, phone, email, reportingTime, offTime, lateThreshold, isActive }`
**Status:** implemented

### DELETE /api/teachers/:id
**Role required:** Admin
**Purpose:** Delete a teacher record (cascades to User via FK). Refuses hard delete if historical records exist.
**Status:** implemented

### POST /api/teachers/:id/reset-password
**Role required:** Admin
**Purpose:** Directly set a new password for a teacher who forgot theirs
**Request body:** `{ newPassword }`
**Status:** implemented

---

## Classes, Sections, Subjects (Admin-managed)

### GET /api/class-sections
**Role required:** Admin (all); Teacher (scoped to assigned classes only); Academics (read-only)
**Purpose:** List class sections with class teacher info and student count
**Status:** implemented

### POST /api/class-sections
**Role required:** Admin
**Purpose:** Create a class section
**Request body:** `{ className, sectionName }`
**Status:** implemented

### PATCH /api/class-sections/:id
**Role required:** Admin
**Purpose:** Edit class section name/section
**Request body:** partial `{ className, sectionName }`
**Status:** implemented

### GET /api/subjects
**Role required:** Admin + Teacher + Academics (read)
**Purpose:** List all subjects with assignment count
**Status:** implemented

### POST /api/subjects
**Role required:** Admin
**Purpose:** Create a subject
**Request body:** `{ name }`
**Status:** implemented

### PATCH /api/subjects/:id
**Role required:** Admin
**Purpose:** Edit subject name
**Request body:** partial `{ name }`
**Status:** implemented

### POST /api/class-sections/:id/class-teacher
**Role required:** Admin
**Purpose:** Assign (or reassign) the single Class Teacher for a ClassSection. Atomic transaction: deactivates old assignment, creates new active one.
**Request body:** `{ teacherId }`
**Status:** implemented

### POST /api/class-sections/:id/subject-teachers
**Role required:** Admin
**Purpose:** Assign a Subject Teacher to a ClassSection+Subject
**Request body:** `{ teacherId, subjectId }`
**Notes:** unique constraint prevents duplicate assignments
**Status:** implemented

### DELETE /api/class-sections/:id/class-teacher
**Role required:** Admin
**Purpose:** Remove the active Class Teacher assignment for a ClassSection. Does not delete the teacher — only removes the relationship. Historical records preserved.
**Status:** implemented

### DELETE /api/class-sections/:id/subject-teachers
**Role required:** Admin
**Purpose:** Remove a Subject Teacher assignment. Does not delete the teacher — only removes the relationship. Historical tests/marks preserved.
**Query params:** `classSectionId`, `teacherId`, `subjectId` (all required)
**Status:** implemented

---

## Students (Admin-managed, Teacher read-only within scope)

### GET /api/students
**Role required:** Admin (all students); Teacher (only students in classes they're assigned to as Class Teacher or Subject Teacher); Academics (all students, read-only)
**Purpose:** List students with class section info
**Query params:** `status` (optional) — `PAST` returns archived students only; omit or any other value returns active students only
**Status:** implemented

### POST /api/students
**Role required:** Admin
**Purpose:** Create a student record and allot to a class/section
**Request body:** `{ name, guardianName, guardianCnic, dateOfBirth, admissionDate, placeOfBirth, bloodGroup?, guardianContact, address, classSectionId, studentId?, rollNumber?, grNumber?, previousSchool? }`
**Notes:** validates guardian CNIC and guardianContact phone formats server-side; validates `dateOfBirth` and `admissionDate` as real `YYYY-MM-DD` dates no later than the current Asia/Karachi local date; validates studentId uniqueness globally and rollNumber uniqueness within class section. `bloodGroup` is optional (enum: A_PLUS, A_MINUS, B_PLUS, B_MINUS, AB_PLUS, AB_MINUS, O_PLUS, O_MINUS). `grNumber` and `previousSchool` are optional free text — omitted/blank values are stored as null. Verified: both-fields-blank and both-fields-filled create paths work.
**Status:** implemented

### PATCH /api/students/:id
**Role required:** Admin
**Purpose:** Edit student fields or reallot to a different class/section
**Request body:** partial `{ name, guardianName, guardianCnic, dateOfBirth, admissionDate, placeOfBirth, bloodGroup, guardianContact, address, classSectionId, studentId, rollNumber, grNumber, previousSchool }`
**Validation:** Supplied `dateOfBirth` and `admissionDate` values must be real `YYYY-MM-DD` dates no later than the current Asia/Karachi local date.
**Status:** implemented

### DELETE /api/students/:id
**Role required:** Admin
**Purpose:** Delete or archive a student record. Checks for historical references (attendance, marks, report cards, certificates, fee challans). If any exist, the student is **archived** (`isActive: false`) rather than hard-deleted — their record is preserved, removed from active rosters, and their Student ID / Roll Number become available for reuse. If no historical records exist, the student is hard-deleted.
**Response (archived):** `{ data: { id, archived: true, message: "Student archived to Past Students..." } }` — HTTP 200
**Response (deleted):** `{ data: { id, deleted: true } }` — HTTP 200
**Status:** implemented

---

## Teacher Attendance (Admin & Academics)

> **Scope amendment (SRS v10):** Academics has **full parity** with Admin on
> teacher attendance — marking Present/Absent/Leave, logging reporting time, and
> logging off time. No narrow off-time-only carve-out; the main marking endpoint
> is shared by both roles. Teachers remain denied.

### GET /api/teacher-attendance
**Role required:** Admin, Academics
**Purpose:** Fetch teacher attendance records, filterable by teacherId and date range
**Query params:** `teacherId`, `from`, `to` (all optional)
**Validation:** Supplied `from` and `to` dates must use ISO `YYYY-MM-DD`, cannot be later than the current Asia/Karachi local date, and `from` cannot be after `to`.
**Status:** implemented

### POST /api/teacher-attendance
**Role required:** Admin, Academics
**Purpose:** Mark or directly edit a teacher's attendance for a date — upsert by teacherId+date, no lock/confirm step. The same endpoint serves both the "mark present + reporting time" step and the "log off time" step (off time re-POSTs with the existing reporting time included).
**Request body:** `{ teacherId, date, status, actualReportingTime?, actualOffTime? }`
**Validation:** `date` must use ISO `YYYY-MM-DD` and cannot be later than the current Asia/Karachi local date. Future attendance submissions return `400 DATE_IN_FUTURE`.
**Status auto-derivation (behavior change):** When `status` is `PRESENT` and `actualReportingTime` is provided, the server compares it against the teacher's configured `lateThreshold` (from TeacherProfile). If the actual time is after the threshold, the stored status is automatically changed to `LATE` instead of `PRESENT`. This is server-side logic — the database records LATE as the canonical status.
**Notes:** `actualReportingTime` and `actualOffTime` are nullable text strings (e.g. `"08:25:00"`). Only populated for PRESENT/LATE records; null for ABSENT/LEAVE. Verified live: Admin + Academics 201, Teacher 403 on both GET and POST; off-time logged by Academics persists (`actualOffTime` round-trips).
**Status:** implemented

### GET /api/teacher-attendance/export
**Role required:** Admin, Academics
**Purpose:** Export teacher attendance CSV with school metadata header
**Query params:** `teacherId` (optional), `from` (optional), `to` (optional)
**Notes:** CSV includes school name, address, phone, generated by, role, and timestamp as header rows
**Status:** implemented

---

## Student Attendance

### GET /api/attendance/classes
**Role required:** Admin, Academics, Teacher
**Purpose:** Get class sections available for attendance marking. Teacher sees only classes where they are the active Class Teacher. Admin/Academics see all.
**Status:** implemented

### GET /api/attendance
**Role required:** Admin (any class); Teacher (only if active Class Teacher); Academics (read-only, any class)
**Purpose:** Fetch attendance records, filterable by classSectionId, date, studentId, from/to date range. Date filters must be real `YYYY-MM-DD` values no later than the current Asia/Karachi local date, and `from` cannot be later than `to`.
**Status:** implemented

### POST /api/attendance
**Role required:** Teacher (must be the active Class Teacher for the given ClassSection)
**Purpose:** Save a draft attendance sheet for a class+date
**Request body:** `{ classSectionId, date, records: [{ studentId, status }] }`
**Notes:** accepts only real `YYYY-MM-DD` dates no later than the current Asia/Karachi local date; upserts as `isConfirmed: false` (Draft); rejects if any record for the class+date is already locked.
**Status:** implemented

### POST /api/attendance/:classSectionId/:date/confirm
**Role required:** Teacher (must be the active Class Teacher for that ClassSection)
**Purpose:** Lock all draft attendance records for this class+date — batch confirm in a transaction
**Status:** implemented

### PATCH /api/attendance/:id
**Role required:** Admin, Academics
**Purpose:** Edit any attendance record (draft or locked). Every edit produces an immutable AttendanceAuditLog entry. Sets `lastEditedByAdmin`.
**Request body:** `{ status }`
**Status:** implemented

### GET /api/attendance/audit
**Role required:** Admin
**Purpose:** View attendance audit history — who changed what, when, from what to what
**Query params:** `classSectionId` (optional), `date` (optional), `studentId` (optional)
**Notes:** Returns up to 200 most recent audit entries with editor name/role and old/new status
**Status:** implemented

### GET /api/attendance/export
**Role required:** Admin (any class); Academics (any class); Teacher (own class, if active Class Teacher)
**Purpose:** Download attendance sheet as CSV with school metadata header
**Query params:** `classSectionId` (required), `date` (required)
**Notes:** CSV includes school name, address, phone, generated by, role, and timestamp as header rows
**Status:** implemented

---

## Tests & Marks (Subject Teacher)

### GET /api/tests
**Role required:** Admin (read, oversight); Teacher (scoped to assigned class+subject combinations); Academics (read-only)
**Query params (optional):** `classSectionId`, `subjectId`
**Status:** implemented

### POST /api/tests
**Role required:** Teacher (must hold a SubjectTeacherAssignment for the given ClassSection+Subject)
**Request body:** `{ classSectionId, subjectId, title, date, maxMarks }`
**Validation:** `date` must be a real `YYYY-MM-DD` value no later than the current Asia/Karachi local date.
**Status:** implemented

### POST /api/tests/:id/marks
**Role required:** Teacher (must own the Test's SubjectTeacherAssignment)
**Purpose:** Enter/update marks for students against a test
**Request body:** `{ records: [{ studentId, marksObtained }] }`
**Notes:** server-side validation rejects marksObtained > maxMarks; upserts in transaction
**Status:** implemented

---

## Report Cards (Class Teacher)

### GET /api/report-cards
**Role required:** Admin (oversight, any); Teacher (scoped to assigned classes); Academics (read-only)
**Query params (optional):** `classSectionId`, `studentId`, `termId`
**Status:** implemented

### POST /api/report-cards
**Role required:** Teacher (must be the active Class Teacher for the target ClassSection)
**Purpose:** Generate an aggregate report card from selected tests across any subject within the class
**Request body:** `{ studentId, classSectionId, termId, testIds: [...] }`
**Notes:** transaction creates ReportCard + ReportCardTest links; cross-subject test selection allowed within class
**Status:** implemented

### POST /api/terms
**Role required:** Teacher
**Purpose:** Create a Term label on the fly (e.g. "Mid Term")
**Request body:** `{ name }`
**Status:** implemented

---

## Academics (Admin-managed)

### GET /api/academics
**Role required:** Admin
**Purpose:** List academics users (with profile data)
**Status:** implemented

### POST /api/academics
**Role required:** Admin
**Purpose:** Create an academics account (User + AcademicsProfile in transaction)
**Request body:** `{ name, cnic, phone, email, password }`
**Notes:** validates CNIC (`xxxxx-xxxxxxx-x`) and phone (`03xx-xxxxxxx`) formats server-side
**Status:** implemented

### PATCH /api/academics/:id
**Role required:** Admin
**Purpose:** Edit academics fields, or set `isActive: false` to revoke
**Request body:** partial `{ name, cnic, phone, email, isActive }`
**Status:** implemented

### DELETE /api/academics/:id
**Role required:** Admin
**Purpose:** Delete an academics record (cascades to User via FK)
**Status:** implemented

### POST /api/academics/:id/reset-password
**Role required:** Admin
**Purpose:** Directly set a new password for an academics user
**Request body:** `{ newPassword }`
**Status:** implemented

---

## Certificates

### GET /api/certificates
**Role required:** Admin, Academics
**Purpose:** List all generated certificates (newest first)
**Response:** `{ data: [{ id, type, student: { ... }, generatedByUser: { ... }, issuedDate, ... }] }`
**Status:** implemented

### POST /api/certificates
**Role required:** Admin, Academics
**Purpose:** Generate a certificate record for a student
**Request body:** `{ studentId, type }` (`LEAVING` | `CHARACTER`)
**Notes:** `generatedByUserId` is set from the authenticated session; print layout available at `/print/certificates/[id]`
**Status:** implemented

---

## Bank Settings

### GET /api/settings/bank
**Role required:** Admin, Academics (read-only)
**Purpose:** Fetch current bank settings (name + account number) for the challan-generation form
**Status:** implemented

### PATCH /api/settings/bank
**Role required:** Admin only (Academics cannot edit bank settings)
**Purpose:** Edit bank name/account number (the "Fees" tab setting)
**Request body:** `{ bankName, bankAccountNumber }`
**Notes:** does not retroactively change already-issued challans (they hold a snapshot)
**Status:** implemented

---

## Fee Challans

### GET /api/students/:id/fee-challans
**Role required:** Admin, Academics
**Purpose:** List a student's fee challan history (newest first)
**Status:** implemented

### POST /api/students/:id/fee-challans
**Role required:** Admin, Academics
**Purpose:** Generate + save a fee challan for a student. This is the combined "edit line items then Print" action — saving and print-readiness happen together.
**Request body:** `{ lineItems: [{ description, amount }, ...] }`
**Notes:** server snapshots current student details (name, guardian name, guardian CNIC, class+section) and current bank settings onto the new row at creation time; computes `total` server-side from line items; requires BankSettings to exist (400 if not); transaction wraps FeeChallan + FeeChallanLineItems
**Status:** implemented

### GET /api/fee-challans/:id
**Role required:** Admin, Academics
**Purpose:** Retrieve a saved challan (e.g. to reprint) — returns the full snapshot + line items plus the full payment history and derived paid total, remaining balance, and status, ready for the print view to render three copies (Bank/Student/School) client-side per the print stylesheet in DESIGN.md
**Status:** implemented

### GET /api/fee-challans/:id/payments
**Role required:** Admin, Academics
**Purpose:** List the complete payment history for one saved challan, newest first, with derived `paidTotal`, `balanceRemaining`, and `status` (`Pending` | `Partial` | `Paid`).
**Response:** `{ data: { payments: [{ id, amount, paidAt, note, recordedByUser: { id, name } }], paidTotal, balanceRemaining, status } }`
**Status:** implemented

### POST /api/fee-challans/:id/payments
**Role required:** Admin, Academics
**Purpose:** Record a payment without modifying the immutable challan snapshot.
**Request body:** `{ amount, paidAt, note? }`
**Response (201):** `{ data: { payment, paidTotal, balanceRemaining, status } }`
**Notes:** `amount` must be a positive integer, `paidAt` is an ISO date/time no later than the current Asia/Karachi local date, `note` is optional, and the server rejects future payments and payments that exceed the remaining balance. Multiple payments per challan are supported.
**Status:** implemented

### GET /api/fee-ledger
**Role required:** Admin, Academics
**Purpose:** School-wide fee ledger showing all saved challans and their derived payment status/balance.
**Query params:** `classSection` (optional text match), `studentId` (optional), `from` and `to` (optional issued-date range), `status` (`Pending` | `Partial` | `Paid`, optional)
**Validation:** Supplied `from` and `to` values cannot be later than the current Asia/Karachi local date, and `from` cannot be after `to`. Blank values remain valid.
**Response:** `{ data: { rows: [{ challanId, studentId, studentName, classSection, issuedDate, total, paidTotal, balanceRemaining, status }], totals: { challans, total, paidTotal, balanceRemaining } } }`
**Status:** implemented

---

## School Settings

### GET /api/settings/school
**Role required:** Admin, Academics (read-only)
**Purpose:** Fetch the singleton SchoolSettings record (school identity configuration)
**Notes:** Creates default settings if none exist
**Status:** implemented

### PATCH /api/settings/school
**Role required:** Admin only
**Purpose:** Update school settings (name, address, phone, email, principal name)
**Request body:** partial `{ schoolName, address, phone, email, principalName }`
**Status:** implemented

### POST /api/settings/school/logo
**Role required:** Admin only
**Purpose:** Upload a school logo (PNG, JPEG, SVG, or WebP; max 2MB)
**Request body:** FormData with `logo` file
**Response (200):** `{ data: { logoPath } }` — logoPath is the persistent Vercel Blob URL
**Notes:** Saves to Vercel Blob storage (persistent across serverless invocations). Requires `BLOB_READ_WRITE_TOKEN` env var. Deletes previous blob if one existed. Updates SchoolSettings.logoPath.
**Status:** implemented

### DELETE /api/settings/school/logo
**Role required:** Admin only
**Purpose:** Remove the school logo from Vercel Blob storage and clear the path in settings
**Status:** implemented

---

## Document Templates (Admin-only)

### GET /api/templates
**Role required:** Admin
**Purpose:** List all document templates, grouped by type
**Query params (optional):** `type` (filter by `LEAVING_CERTIFICATE`, `CHARACTER_CERTIFICATE`, `REPORT_CARD`, `FEE_CHALLAN`)
**Status:** implemented

### POST /api/templates
**Role required:** Admin
**Purpose:** Upload a new document template (image or PDF)
**Request body:** FormData with `file` (image/PDF) and `type` (enum value)
**Notes:** If PDF, the client converts to PNG before upload (see ARCHITECTURE.md). Stores original file and background image via Vercel Blob. Sets `isActive: true` for this type (deactivates previous active).
**Response (201):** `{ data: { id, type, backgroundImageUrl, isActive } }`
**Status:** implemented

### PATCH /api/templates/:id
**Role required:** Admin
**Purpose:** Activate a template (set as active for its type), or update metadata
**Request body:** `{ isActive: true }` — deactivates all other templates of the same type
**Status:** implemented

### GET /api/templates/:id/fields
**Role required:** Admin
**Purpose:** Get all field positions and table regions for a template
**Response:** `{ data: { fields: [...], tableRegions: [...] } }`
**Status:** implemented### POST /api/templates/:id/fields
**Role required:** Admin
**Purpose:** Save all field positions and table regions for a template (replaces existing)
**Request body:** `{ fields: [{ fieldKey, xPercent, yPercent, widthPercent?, heightPercent?, fontSize, textAlign, fontFamily?, fontColor?, fontWeight?, fontStyle?, textDecoration? }], tableRegions: [{ anchorXPercent, anchorYPercent, rowHeightPercent, columns: [{ fieldKey, xPercent, label }] }] }`
**Notes:** Atomic — replaces all positions in one transaction. Zod validation enforces column shape (fieldKey, xPercent, label all required, non-empty).
**Status:** implemented

### DELETE /api/templates/:id
**Role required:** Admin
**Purpose:** Delete a template and its Vercel Blob files
**Notes:** Refuses if any documents reference the template (409 IN_USE). Cascades to TemplateField and TemplateTableRegion.
**Status:** implemented

### GET /api/templates/active?type=LEAVING_CERTIFICATE
**Role required:** Admin, Academics, Teacher (for rendering documents)
**Purpose:** Get the active template for a document type, with its field positions
**Query params:** `type` (required — LEAVING_CERTIFICATE, CHARACTER_CERTIFICATE, REPORT_CARD, FEE_CHALLAN)
**Response:** `{ data: { template, fields, tableRegions } }` or 404 if no active template
**Status:** implemented

---

## Salary Slips (generation: Admin + Academics; rates: Admin-only)

> **Scope (SRS §1.11):** Academics can generate salary slips (search, date range, review breakdown with waive toggles, generate & save) — same capability as Admin. Salary **rates** (`perDaySalary`, `lateDeductionType`, `lateDeductionValue`) are configured by **Admin only** via `POST/PATCH /api/teachers` (already ADMIN-only, enforced server-side — verified: Academics PATCH to a teacher's rate fields returns 403). A teacher with no configured rates yields `400 SALARY_NOT_CONFIGURED` — no silent default.

### GET /api/salary-slips
**Role required:** Admin, Academics
**Purpose:** List saved salary slips, newest first
**Query params (all optional):** `teacherId`, `from`, `to` (period range)
**Response:** `{ data: [{ id, teacher: { id, name }, periodFrom, periodTo, perDaySalary, lateDeductionType, lateDeductionValue, baseAmount, netAmount, generatedByUser: { id, name }, issuedDate, deductions: [{ id, date, type, amount, waived }] }] }`
**Status:** implemented

### POST /api/salary-slips/preview
**Role required:** Admin, Academics
**Purpose:** Compute the salary breakdown for a teacher over a date range **without saving**. This is the "review then generate" step (same pattern as Fee Challan).
**Request body:** `{ teacherId, from, to }` (ISO dates)
**Response:** `{ data: { teacher: { id, name }, periodFrom, periodTo, perDaySalary, lateDeductionType, lateDeductionValue, workingDays, leaveDays, baseAmount, deductions: [{ lineId: "d-0", date, type: "LATE"|"ABSENT", amount, waived: false }], totalDeductions, netAmount } }`
**Notes:** `from` and `to` must be real `YYYY-MM-DD` dates no later than the current Asia/Karachi local date, with `from` not after `to`. Deduction math: Absent = full `perDaySalary`; Late = `lateDeductionValue` (AMOUNT) or `round(perDaySalary × lateDeductionValue / 100)` (PERCENTAGE); Leave/Present = none; unmarked days are not counted as working days. Returns `400 SALARY_NOT_CONFIGURED` if the teacher has no rates. `lineId`s are stable identifiers used for waiver.
**Status:** implemented

### POST /api/salary-slips
**Role required:** Admin, Academics
**Purpose:** Generate + save a salary slip. Takes the reviewed breakdown and the per-line waiver decisions; only **non-waived** deduction lines are persisted.
**Request body:** `{ teacherId, from, to, waivedIds?: ["d-0", …] }` (waivedIds = `lineId`s to exclude)
**Notes:** `from` and `to` must be real `YYYY-MM-DD` dates no later than the current Asia/Karachi local date, with `from` not after `to`. Transaction creates the `SalarySlip` + its `SalarySlipDeduction` rows (net = base − non-waived deductions). Immutable once saved — regenerating the same period creates a new slip. Print view at `/print/salary-slips/[id]`.
**Status:** implemented

---

## Daily Agenda

### GET /api/agenda
**Role required:** Teacher (own entries only, scoped to assigned class+subject combinations); Admin (all entries, read-only)
**Purpose:** Fetch daily agenda entries. Teacher sees only entries they authored, scoped to their SubjectTeacherAssignment combinations. Admin sees all entries across all teachers.
**Query params (all optional):** `classSectionId`, `subjectId`, `date`, `from` (date range start), `to` (date range end), `teacherId` (Admin only)
**Response:** `{ data: [{ id, content, date, isLocked, teacher: { id, name }, classSection: { id, className, sectionName }, subject: { id, name }, createdAt, updatedAt }] }`
**Notes:** `isLocked` is derived server-side: `true` if the entry's date is before today (Asia/Karachi timezone), `false` otherwise. Not stored in the database. Supplied `date`, `from`, and `to` filters cannot be later than today's Asia/Karachi date, and `from` cannot be after `to`.
**Status:** implemented

### POST /api/agenda
**Role required:** Teacher (must hold a SubjectTeacherAssignment for the given classSectionId + subjectId)
**Purpose:** Create or update a daily agenda entry. Upserts by (teacherId, classSectionId, subjectId, date) — if an entry already exists for that combination, it updates instead of creating a duplicate.
**Request body:** `{ classSectionId, subjectId, date, content }`
**Validation:** Server rejects if `date` is in the past or later than today in Asia/Karachi timezone. Future submissions return `400 DATE_IN_FUTURE`; past submissions return `400 DATE_LOCKED`. Content must be 1–5000 characters.
**Response (200/201):** `{ data: { id, content, date, isLocked: false, ... } }`
**Status:** implemented

### PATCH /api/agenda/:id
**Role required:** Teacher (must be the author of the entry, i.e. same teacherId)
**Purpose:** Update an existing agenda entry's content. Server rejects if the entry's date is in the past or later than today (same shared local-date helpers as POST).
**Request body:** `{ content }`
**Response (200):** `{ data: { id, content, date, isLocked, ... } }`
**Status:** implemented

---

## Design-System Completion

This phase introduces no new endpoint or response contract. Existing routes retain the standard success and error shapes while their shared UI consumers receive the documented focus, hover, loading, empty, error, disabled, responsive, and status-indicator refinements.

---

## Global Search (Admin & Academics)

### GET /api/search?q=...
**Role required:** Admin, Academics
**Purpose:** Search active school records from the shared dashboard search entry point.
**Query params:** `q` (optional; blank queries return an empty result set)
**Response:** `{ data: { query, results: [{ type, id, title, subtitle, href }] } }`
**Result scope:** Active Students, active Teachers, Class/Section records, Subjects, Fee Challans, and Tests. Admin additionally receives Daily Agenda results. Inactive Students and inactive Teacher accounts are excluded server-side. Teachers receive `403 FORBIDDEN` and have no school-wide search trigger in their dashboard shell.
**Status:** implemented

---

## Backup Export (Admin-only)

### GET /api/backup/export
**Role required:** Admin
**Purpose:** Download a complete on-demand JSON backup bundle of the LMS.
**Response:** File attachment with `Content-Type: application/json` and `Content-Disposition: attachment; filename="school-lms-backup-YYYY-MM-DD.json"`.
**Bundle shape:** `{ schemaVersion, exportedAt, data: { users, adminRecoveryCodes, teacherProfiles, academicsProfiles, classSections, subjects, classTeacherAssignments, subjectTeacherAssignments, students, studentAttendance, teacherAttendance, attendanceAuditLogs, tests, marks, terms, reportCards, reportCardTests, certificates, bankSettings, feeChallans, feeChallanLineItems, feeChallanPayments, documentTemplates, templateFields, templateStaticTexts, templateTableRegions, salarySlips, salarySlipDeductions, dailyAgenda } }`.
**Notes:** Password hashes, recovery-code hashes, session tokens, and other authentication secrets are excluded. The endpoint is read-only, does not create a backup row, and returns `401 UNAUTHENTICATED` or `403 FORBIDDEN` for non-Admin access.
**Status:** implemented

---

## Not Yet Scoped


- No remaining API-level gaps — rate limiting, recovery code lifecycle, and document templates are fully implemented
