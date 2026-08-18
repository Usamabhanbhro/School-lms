# School LMS — API Reference

Living document. Every API route must be added here when created — see `CONVENTIONS.md` and `AGENTS.md`.

**Status: reconciled with SRS.md v3.** Two login roles only: Admin, Teacher. No Student/Parent-facing endpoints.

## Conventions Recap

- REST-shaped, resource-based paths, plural nouns
- Auth: session-based (NextAuth), every route checks role before executing
- Success: `{ "data": ... }` — Error: `{ "error": { "message": "...", "code": "..." } }`

---

## Auth

### POST /api/auth/[...nextauth]
NextAuth handler — login/logout/session. Credentials provider only.

### GET /api/admin/recovery-code (regenerate)
Wording TBD at implementation — likely `POST /api/admin/recovery-code/regenerate`.
**Role required:** Admin (authenticated)
**Purpose:** Manually rotate the admin's recovery code. Returns the new plaintext code once; only its hash is persisted.

### POST /api/admin/recover
**Role required:** none (public route — this is the recovery path for a locked-out Admin)
**Purpose:** Verify username/email + recovery code, then allow setting a new password
**Request body:** `{ usernameOrEmail, recoveryCode, newPassword }`
**Notes:** on success, invalidates the used code and generates+returns a new one. Rate-limit this route — it's a public endpoint accepting a secret.

---

## Teachers (Admin-managed)

### GET /api/teachers
**Role required:** Admin
**Purpose:** List teachers

### POST /api/teachers
**Role required:** Admin
**Purpose:** Create a teacher account
**Request body:** `{ name, fatherOrSpouseName, cnic, phone, email, password }`
**Notes:** validates CNIC (`xxxxx-xxxxxxx-x`) and phone (`03xx-xxxxxxx`) formats server-side

### PATCH /api/teachers/:id
**Role required:** Admin
**Purpose:** Edit teacher fields, or set `isActive: false` to revoke

### DELETE /api/teachers/:id
**Role required:** Admin
**Purpose:** Delete a teacher record

### POST /api/teachers/:id/reset-password
**Role required:** Admin
**Purpose:** Directly set a new password for a teacher who forgot theirs
**Request body:** `{ newPassword }`

---

## Classes, Sections, Subjects (Admin-managed)

### GET/POST /api/class-sections
**Role required:** Admin (write); Admin + assigned Teacher (read, scoped to their own assignments)

### GET/POST /api/subjects
**Role required:** Admin (write); Admin + Teacher (read)

### POST /api/class-sections/:id/class-teacher
**Role required:** Admin
**Purpose:** Assign (or reassign) the single Class Teacher for a ClassSection
**Request body:** `{ teacherId }`
**Notes:** reassigning should deactivate the previous ClassTeacherAssignment, not create a second active one

### POST /api/class-sections/:id/subject-teachers
**Role required:** Admin
**Purpose:** Assign a Subject Teacher to a ClassSection+Subject
**Request body:** `{ teacherId, subjectId }`

---

## Students (Admin-managed, Teacher read-only within scope)

### GET /api/students
**Role required:** Admin (all students); Teacher (only students in classes they're assigned to)

### POST /api/students
**Role required:** Admin
**Request body:** `{ name, guardianName, guardianCnic, dateOfBirth, admissionDate, classSectionId }`

### PATCH /api/students/:id
**Role required:** Admin

---

## Teacher Attendance (Admin-managed)

### GET /api/teacher-attendance
**Role required:** Admin

### POST /api/teacher-attendance
**Role required:** Admin
**Purpose:** Mark or directly edit a teacher's attendance for a date — no lock/confirm step
**Request body:** `{ teacherId, date, status }`

---

## Student Attendance

### GET /api/attendance
**Role required:** Admin (any class); Teacher (only if Class Teacher for that ClassSection)
**Purpose:** Fetch attendance records, filterable by class/date range/student
**Notes:** highest-traffic endpoint, expect mobile use from teachers — keep payload lean

### POST /api/attendance
**Role required:** Teacher (must be the active Class Teacher for the given ClassSection)
**Purpose:** Save a draft attendance sheet for a class+date
**Request body:** `{ classSectionId, date, records: [{ studentId, status }] }`
**Notes:** idempotent while draft (`isConfirmed: false`) — resubmitting updates rather than duplicates

### POST /api/attendance/:classSectionId/:date/confirm
**Role required:** Teacher (must be the Class Teacher who owns the draft)
**Purpose:** Lock the attendance sheet — irreversible for the teacher after this point
**Notes:** once locked, only Admin can modify (see below)

### PATCH /api/attendance/:id
**Role required:** Admin only, and only when `isConfirmed: true` (this is the override path)
**Notes:** should set `lastEditedByAdmin` per SCHEMA.md

### GET /api/attendance/export
**Role required:** Admin (any class); Teacher (own class, if Class Teacher)
**Purpose:** Download attendance sheet as printable CSV

---

## Tests & Marks (Subject Teacher)

### GET/POST /api/tests
**Role required:** Teacher (must hold a SubjectTeacherAssignment for the given ClassSection+Subject); Admin (read, oversight)
**Request body (POST):** `{ classSectionId, subjectId, title, date, maxMarks }`

### POST /api/tests/:id/marks
**Role required:** Teacher (must own the Test's SubjectTeacherAssignment)
**Purpose:** Enter/update marks for students against a test
**Request body:** `{ records: [{ studentId, marksObtained }] }`

---

## Report Cards (Subject Teacher)

### GET /api/tests?classSectionId=&subjectId=
Reused from above — powers the "select which tests count" step in report card generation.

### POST /api/terms
**Role required:** Teacher
**Purpose:** Create a Term label on the fly (e.g. "Mid Term")
**Request body:** `{ name }`

### POST /api/report-cards
**Role required:** Teacher (must own the underlying SubjectTeacherAssignment(s))
**Purpose:** Generate an aggregate report card from selected tests
**Request body:** `{ studentId, classSectionId, termId, testIds: [...] }`

### GET /api/report-cards
**Role required:** Admin (oversight, any); Teacher (own)

---

## Certificates — functional stub, design deferred

### POST /api/certificates
**Role required:** Admin
**Request body:** `{ studentId, type }` (`LEAVING` | `CHARACTER`)
**Notes:** output format/layout not implemented until a design pass happens; this route exists to establish the data record

---

## Fee Challan

### GET /api/settings/bank
**Role required:** Admin
**Purpose:** Fetch current bank settings (name + account number) for the challan-generation form

### PATCH /api/settings/bank
**Role required:** Admin
**Purpose:** Edit bank name/account number (the "Fees" tab setting)
**Request body:** `{ bankName, bankAccountNumber }`
**Notes:** does not retroactively change already-issued challans (they hold a snapshot)

### POST /api/students/:id/fee-challans
**Role required:** Admin
**Purpose:** Generate + save a fee challan for a student. This is the combined "edit line items then Print" action — saving and print-readiness happen together.
**Request body:** `{ lineItems: [{ description, amount }, ...] }`
**Notes:** server snapshots current student details (name, guardian name, guardian CNIC, class+section) and current bank settings onto the new row at creation time; computes `total` server-side from line items

### GET /api/fee-challans/:id
**Role required:** Admin
**Purpose:** Retrieve a saved challan (e.g. to reprint) — returns the full snapshot + line items, ready for the print view to render three copies (Bank/Student/School) client-side per the print stylesheet in DESIGN.md

### GET /api/students/:id/fee-challans
**Role required:** Admin
**Purpose:** List a student's fee challan history

---

## Not Yet Scoped

- Certificate/report card/fee challan PDF or print rendering (three-copy layout for fee challan specifically)
- Rate limiting on `/api/admin/recover` — needs a concrete policy before going to production, since it's the one public, secret-accepting endpoint in the system
