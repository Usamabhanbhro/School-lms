# School LMS — API Reference

Living document. Every API route must be added here when created — see `CONVENTIONS.md` and `AGENTS.md`.

**Status: reconciled with SRS.md v5.** Three login roles: Admin, Academics, Teacher. No Student/Parent-facing endpoints.
Phase 1–6 routes are implemented. Admin provisioning, school settings, and admin self-recovery added.

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
**Request body:** `{ name, fatherOrSpouseName, cnic, phone, email, password }`
**Notes:** validates CNIC (`xxxxx-xxxxxxx-x`) and phone (`03xx-xxxxxxx`) formats server-side; derives username from email prefix or CNIC
**Status:** implemented

### PATCH /api/teachers/:id
**Role required:** Admin
**Purpose:** Edit teacher fields, or set `isActive: false` to revoke
**Request body:** partial `{ name, fatherOrSpouseName, cnic, phone, email, isActive }`
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
**Status:** implemented

### POST /api/students
**Role required:** Admin
**Purpose:** Create a student record and allot to a class/section
**Request body:** `{ name, guardianName, guardianCnic, dateOfBirth, admissionDate, classSectionId, studentId?, rollNumber? }`
**Notes:** validates guardian CNIC format server-side; validates studentId uniqueness globally and rollNumber uniqueness within class section
**Status:** implemented

### PATCH /api/students/:id
**Role required:** Admin
**Purpose:** Edit student fields or reallot to a different class/section
**Request body:** partial `{ name, guardianName, guardianCnic, dateOfBirth, admissionDate, classSectionId, studentId, rollNumber }`
**Status:** implemented

---

## Teacher Attendance (Admin-managed)

### GET /api/teacher-attendance
**Role required:** Admin
**Purpose:** Fetch teacher attendance records, filterable by teacherId and date range
**Query params:** `teacherId`, `from`, `to` (all optional)
**Status:** implemented

### POST /api/teacher-attendance
**Role required:** Admin
**Purpose:** Mark or directly edit a teacher's attendance for a date — upsert by teacherId+date, no lock/confirm step
**Request body:** `{ teacherId, date, status }`
**Status:** implemented

### GET /api/teacher-attendance/export
**Role required:** Admin
**Purpose:** Download teacher attendance records as CSV with school metadata header
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
**Purpose:** Fetch attendance records, filterable by classSectionId, date, studentId, from/to date range
**Status:** implemented

### POST /api/attendance
**Role required:** Teacher (must be the active Class Teacher for the given ClassSection)
**Purpose:** Save a draft attendance sheet for a class+date
**Request body:** `{ classSectionId, date, records: [{ studentId, status }] }`
**Notes:** upserts as `isConfirmed: false` (Draft); rejects if any record for the class+date is already locked
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
**Purpose:** Retrieve a saved challan (e.g. to reprint) — returns the full snapshot + line items, ready for the print view to render three copies (Bank/Student/School) client-side per the print stylesheet in DESIGN.md
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
**Request body:** `{ fields: [{ fieldKey, xPercent, yPercent, fontSize, textAlign }], tableRegions: [{ anchorXPercent, anchorYPercent, rowHeightPercent, columns: [{ fieldKey, xPercent, label }] }] }`
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

## Not Yet Scoped


- No remaining API-level gaps — rate limiting, recovery code lifecycle, and document templates are fully implemented
