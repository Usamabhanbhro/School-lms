# School LMS — Software Requirements Specification (SRS)

**Status: Draft v15 — corrects future-date validation for attendance, Daily Agenda, Fee Ledger filters, and fee payments.** Three login roles: **Admin** (single account, the Principal), **Academics** (multiple accounts, delegated certificate/challan generation and attendance editing), and **Teacher** (multiple accounts). Students are data records, not accounts. No Parent access.

---

## 1. Admin (Principal)

Single admin account per school — not multiple admin logins.

### 1.1 Teacher Management

Add teacher — required fields:
- Name
- Father/spouse name
- CNIC — format `xxxxx-xxxxxxx-x`
- Phone number — format `03xx-xxxxxxx`
- Email
- Password — set by Admin at creation

Admin can: edit any field, delete a teacher, revoke a teacher's login (disable without deleting — historical attendance/marks/tests they created remain intact), and directly reset/change a teacher's password (no email-reset flow).

### 1.2 Class, Section & Subject Setup

Admin creates Classes/Sections (e.g. "Grade 5 - A") and Subjects (e.g. "Mathematics") as base data.

Admin allots teachers in **two distinct ways**:
- **Class Teacher** — exactly one active teacher per class+section, holds attendance-marking rights for that class. No other teacher can mark/confirm attendance for that class unless they are the active Class Teacher. A teacher may be Class Teacher for **multiple** class sections simultaneously (e.g. Grade 5-A and Grade 6-B).
- **Subject Teacher** — a teacher assigned to a class+section+subject combination, holds rights to create tests, enter marks, and generate report cards for that subject. Multiple subject teachers per class (one per subject), and a teacher can hold multiple subject-teacher assignments across classes.

A teacher may simultaneously be a Class Teacher for one or more classes and a Subject Teacher for others (or the same class). Being a Subject Teacher for a class does **not** confer Class Teacher attendance authority for that class.

**Unassignment:** Admin can unassign a Class Teacher (deactivates the assignment) or unassign a Subject Teacher (removes the assignment). Unassignment does **not** delete the teacher, the subject, the class, or any historical records (attendance, tests, marks, report cards). Only the relationship is removed. A confirmation dialog is shown before unassignment.

### 1.3 Student Management

Admin creates Student records and allots each student to a class+section. Required fields:
- Name
- Father/guardian name
- Father/guardian CNIC — format `xxxxx-xxxxxxx-x` (student does not have their own CNIC on file)
- Date of birth
- Admission date
- Place of birth
- Guardian contact (phone) — format `03xx-xxxxxxx`, same validation as TeacherProfile.phone
- Address

**Optional fields:**
- **Blood Group** — fixed enum: A+, A-, B+, B-, AB+, AB-, O+, O-. Select/dropdown, marked "(optional)". Not free text — enum ensures data quality.

**Optional fields (Admin/ACADEMICS-assigned):**
- **Student ID** — a unique identifier assigned by Admin or Academics (e.g. `STD-2026-001`). Auto-suggested on creation based on existing records, but the value is **editable** before save. Globally unique across all students. Nullable for existing records — not retroactively generated.
- **Roll Number** — a class-section-scoped number assigned by Admin or Academics. Auto-suggested based on existing roll numbers in the class section, but the value is **editable** before save. Unique within the class section (not globally). Nullable for existing records.

Both fields are validated server-side for uniqueness. Duplicate values produce a clear error message. Moving a student to a different class section does not create uniqueness conflicts for roll number.

**Optional fields (free text):**
- **GR Number** — general-register / admission registration number. Optional free text (≤50 chars), no uniqueness requirement. Blank = not recorded.
- **Previous School** — school attended before admission. Optional free text (≤200 chars), informational only.

Both follow the same optional-field pattern as Blood Group: no validation error when left blank, stored as null when omitted. Verified both-blank and both-filled create paths.

**Student archive ("Past Students"):**
- A student with any historical records (attendance, marks, report cards, certificates, fee challans) **cannot be hard-deleted**. Instead, Admin archives them to "Past Students": the student record is preserved in full (all historical data stays linked and viewable), removed from active class rosters and any current-term workflows (attendance marking, marks entry no longer show them), but their Student ID / Roll Number becomes available for reuse by a new student.
- A student with zero historical records can still be hard-deleted outright — nothing to preserve.
- Past Students are listed in a dedicated "Past Students" tab on the Students page, read-only (no edit button), with historical records still accessible.
- All active-workflow queries (attendance marking, marks entry, class rosters, report card generation, fee challan generation) filter to `isActive: true` only — archived students are invisible in those flows without any UI-level filtering.
- Admin can hard-delete a Past Student (one with zero historical records) from the Past Students tab.

Teachers only see students within the class(es) they're assigned to (as class teacher or subject teacher).

### 1.4 Teacher Attendance

**Admin and Academics** mark teacher attendance directly (Present/Absent/Leave), including logging reporting time and off time. No draft/confirm lock — direct edit access at all times, since Admin (and, by amendment, Academics) is already above the teacher being tracked.

> **Scope amendment (v10):** Academics has **full parity** with Admin on teacher attendance — marking Present/Absent/Leave, logging reporting time, and logging off time. This deliberately replaces an earlier draft that only granted Academics an off-time-only carve-out; the final decision is full parity, and the main marking endpoint serves both roles. Academics does **not** gain any other admin powers through this — everything else in §1A.2 boundaries still applies. Teachers remain denied (they only mark *student* attendance for their own class).

**Configured schedule per teacher** (set at creation, editable later via the existing teacher edit flow):
- `reportingTime` — expected arrival time (stored as `HH:MM:SS` text, using Prisma's consistent string representation for time-of-day)
- `offTime` — expected departure time
- `lateThreshold` — arrival time after which the teacher is auto-marked LATE

All three are nullable — not every teacher needs a configured schedule.

**Daily actual-time logging** (entered by Admin each time attendance is marked):
- `actualReportingTime` — the teacher's actual arrival time, entered by Admin when marking PRESENT/LATE
- `actualOffTime` — the teacher's actual departure time, entered by Admin
- Both nullable — null for ABSENT/LEAVE records

**Status auto-derivation rule** (implemented server-side, documented explicitly here):
When Admin marks a teacher PRESENT and enters an `actualReportingTime`, the server compares it against that teacher's configured `lateThreshold`. If the actual time is after the threshold, the stored status automatically becomes **LATE** instead of PRESENT. This is server-side logic in the API route, not a UI-only display choice — the database stores LATE as the canonical status.

Admin and Academics retain full direct edit rights on TeacherAttendance records — can change status, actual times, or both at any time. The UI is a two-step flow: marking Present opens a reporting-time input (defaults to current time, editable); once reporting time is logged, a distinct "Log Off Time" action appears. Absent/Leave rows never show time inputs.

**Teacher Attendance CSV Export:** Admin and Academics can download teacher attendance records as CSV. The export supports filtering by:
- All teachers (no teacher filter)
- A specific teacher (by teacher ID)
- Date range (from/to)

The CSV includes columns: Teacher Name, Phone, Date, Status, Reporting Time, Off Time. The CSV includes school metadata as header rows (see §8).

### 1.5 Student Attendance Oversight

Admin can view any class's attendance sheet (any date), download it as printable CSV, and **edit attendance even after it's been confirmed/locked by the class teacher**.

**Attendance editing:** Admin and Academics can edit any student attendance record (draft or locked). Every edit produces an immutable audit log entry (see §7). Admin can also edit teacher attendance (see §1.4). Neither Admin nor Academics can delete attendance records.

**Student Attendance CSV Export:** Admin and Academics can download student attendance as CSV for any class+date. Teachers can export for their own class (if active Class Teacher). The CSV includes school metadata as header rows (see §8).

### 1.6 Oversight of Teacher-Generated Content

Admin can view, for any class/subject: tests and marks entered by subject teachers, and report cards generated by teachers.

### 1.7 Admin Password Recovery

Since there is exactly one Admin and no one above them, Admin cannot rely on "someone resets it for me" (that's how Teacher recovery works, via Admin — see 1.1). Admin recovery must be **self-service**, since this app is intended to be sold/deployed per-school with no ongoing vendor involvement.

**Recovery Code model:**
1. At initial admin account setup, the system generates one long random recovery code and displays it **once**, with an explicit warning to store it safely. Only a hash of the code is stored — never plaintext.
2. A public route (`/admin/recover`) lets the admin enter their username/email + recovery code to set a new password.
3. On successful recovery, the old code is invalidated and a new one is generated and shown once — so a leaked-but-unused code can't be reused, and the admin always has exactly one valid recovery code.
4. Admin can also manually regenerate their recovery code at any time from the panel (e.g. if they suspect it's been seen by someone else).

**Known tradeoff:** if both the password and the recovery code are lost, there is no further self-service recovery path — this is the accepted cost of removing vendor/developer involvement from password recovery. This is an **unrecoverable-by-self-service state by design**: full lockout requires paid manual intervention via direct database access (see `RECOVERY.md` for the developer runbook). This should be called out clearly in onboarding material for each school.

### 1.8 Certificates — Template-Based Generation

Admin (and Academics — see §1A) generate, per student: **Leaving Certificate** or **Character Certificate**. Document layout is defined by **templates** that Admin uploads and configures (template system details, field placement, and table regions are defined in §3).

**Template workflow:**
1. Admin uploads a template image (PNG/JPG) or PDF (converted client-side to an image) as the document background.
2. Admin uses a visual editor to place fields at specific positions on the template (percentage-based coordinates so positions scale across screen sizes and print).
3. Positions are saved and reused for every future document of that type.
4. Templates are **versioned**: already-generated documents reference the template version that was active when they were created. Changing the active template does not reflow historical documents.

**Field keys for Leaving Certificate:** studentName, guardianName, classSection, admissionDate, dateOfLeaving, dob, issueDate

**Field keys for Character Certificate:** studentName, guardianName, classSection, dob, conductRemark, issueDate

**Generation flow:** Admin selects a student, chooses certificate type (LEAVING or CHARACTER), and clicks Generate. The system creates the certificate record (snapshots student data and the active template ID), then renders the print view by overlaying the student's data onto the template background at the saved positions.

**Fallback:** If no active template exists for a certificate type, the print view shows a clear message: "No template configured — ask your Admin to upload one in Settings" instead of rendering blank.

### 1.9 Fee Challan — Template-Based Generation

Admin (and Academics — see §1A) generate a fee challan by selecting a student. Template system details, field placement, and table regions are defined in §3. The generation view:

- **Bank details** — bank name, bank account number. Sourced from a school-wide **Bank Settings** singleton (a "Fees" tab where Admin can edit these independently of any single challan). Snapshotted onto the challan at generation time, so historical challans stay accurate even if bank details change later.
- **Student details** (read-only, pulled from the Student record) — name, father/guardian name, guardian CNIC, class, section. Also snapshotted at generation time, for the same reason.
- **Fee line items** — Admin can edit the base fee and **add arbitrary line items** (e.g. "Arrears", "Late Fee") as description + amount pairs. Total is computed as the sum.
- **Print action** — clicking Print **saves the challan** (persists it with its snapshot of bank/student details, line items, issue date, and active template ID) and then produces the printable output.

**Template-based print layout:** The Fee Challan template is the **full page** — Admin manually places fields **three times** (once per copy: Bank Copy, Student Copy, School Copy). There is **no auto-triplication** of positions. Admin is responsible for laying out all three copies on the single template image.

**Table Region:** The Fee Challan has a variable number of line items (rows). The template supports a **Table Region** — an anchor position, row height, and column x-positions — that repeats for each line item. Admin places the table region once; the renderer lays out N rows starting at the anchor, incrementing y by rowHeight per row.

**Field keys:** studentName, guardianName, guardianCnic, classSection, bankName, bankAccountNumber, issueDate, total

**Table Region columns:** description, amount

**Fallback:** If no active template exists, the print view shows a clear message instead of rendering blank.

Once saved, a challan is treated as an immutable historical record — regenerating for the same student creates a new challan rather than editing the old one. The template version used at generation time is recorded on the challan.

**Fee Ledger and partial payments:** Every saved challan starts with a derived `Pending` status and balance equal to its total. Admin or Academics can record a payment against any saved challan with an amount, payment date, and optional note. Multiple payments are allowed over time. Payments are separate linked records and never modify the original challan snapshot. At read time, the server sums recorded payments and derives `Pending` when paid total is zero, `Partial` when paid total is greater than zero but below the challan total, and `Paid` when paid total equals the challan total. Overpayments are rejected. Payment dates cannot be later than the school's current local date. The challan detail/history view shows the full payment history, and the school-wide Fee Ledger lists derived balances with class, student, and issued-date filters. Fee Ledger Issued From/To filters are bounded by the current local date and must preserve From <= To.

### 1.10 Teacher Salary Slip

Admin configures, per teacher (in the Users → Teachers tab, at creation or edit):
- `perDaySalary` — daily pay (Rs.)
- `lateDeductionType` — `AMOUNT` or `PERCENTAGE` (which applies is picked per teacher)
- `lateDeductionValue` — flat Rs. (AMOUNT) or % of per-day salary (PERCENTAGE)

**Deduction rules (derived from teacher attendance in the selected period):**
- Absent day → full day's pay deducted (unpaid), per-day salary, no separate configurable amount
- Late day → deducted per the teacher's configured late-deduction setting
- Leave day → fully paid, no deduction
- A day with no attendance record is not counted as a working day

**Waiver capability:** When generating, the system computes suggested deductions (one line per Late or Absent day). Before finalizing, the user can individually waive any specific deduction line (toggle per line) — waived lines don't reduce the net. This is a per-instance decision made at generation time, **not** a global setting.

**Generation flow (review then generate & save, same pattern as Fee Challan):** user searches a teacher by name, selects a date range (default: current month), reviews the computed breakdown (base pay, itemized deductions with waive toggles, net total), and generates the slip. The slip is **immutable once saved** — regenerating for the same period creates a new slip, never edits the old one.

**Role split (explicit):**
- **Academics CAN generate** salary slips — full generation flow (search, date range, review, waive, generate & save) identical to Admin. This was a deliberate added capability.
- **Only Admin CAN configure rates.** `perDaySalary`, `lateDeductionType`, `lateDeductionValue` are editable only in the Admin-only Users management; the rate-config routes (`POST/PATCH /api/teachers`) reject Academics with 403 (verified at API level, not just hidden in the UI). A teacher with no configured rates shows the clear message — "Salary rate not configured for this teacher — ask Admin to set it in Users" — instead of silently paying zero.

**Assumption (documented):** Salary Slip is built with a **coded print layout** (`/print/salary-slips/[id]`) for the first pass, rather than as a fifth Document Template type. Rationale: the template system requires Admin to upload a background (none exist in current deployments), while the coded layout produces a usable slip immediately; the `SalarySlip` model already snapshots config and the `DocumentTemplateType` enum includes `SALARY_SLIP`, so a template-based print can be dropped in later without schema changes. If you want a branded template now, the template system is ready to extend.

### 1.11 Daily Agenda Oversight

Admin has read-only visibility into all daily agenda entries across all teachers, classes, subjects, and dates — same oversight pattern as attendance (§1.5), marks (§1.6), and report cards (§1.6).

**Filters:** Admin can filter by teacher, class+subject, and date range. The admin agenda view is read-only — no write actions, no edit buttons, no ability to modify or delete any entry. Agenda date filters cannot be later than the current local date, and From must not be after To.

**Date rule:** Daily Agenda is now current-or-historical only. Teacher date entry and server submission reject future dates; past entries remain locked for editing, while today's entry remains editable. This supersedes the earlier assumption that teachers could plan future agenda entries.

**Scope note:** Academics does **NOT** have access to the Daily Agenda feature — neither read-only oversight nor write access. This is a deliberate scope decision, not an oversight. The Daily Agenda is a teacher-admin communication channel (lesson logs for principal oversight), which is outside Academics' delegated scope of certificate/challan generation and attendance editing. Adding Academics access would require a separate product decision and is not part of this feature.

### 1.12 On-Demand Backup Export

Admin can download a complete, lossless backup of the LMS on demand from Settings. The export is generated as a single JSON attachment rather than a multi-sheet spreadsheet because its purpose is restoration and archival, not visual reporting. A single bundle preserves IDs, relationships, nullable values, timestamps, enum values, snapshots, and append-only history without spreadsheet conversion ambiguity.

The Admin-only `GET /api/backup/export` endpoint returns a file download with `Content-Disposition: attachment`, a stable `schemaVersion`, an `exportedAt` timestamp, and every meaningful application table required to restore school data, including users, profiles, classes, subjects, assignments, students, attendance, tests, marks, terms, report cards, certificates, templates, bank settings, fee challans, fee line items, fee payments, salary slips, salary deductions, daily agenda entries, and attendance audit logs. Password hashes and other authentication secrets are excluded from the export.

The Settings page exposes one explicit **Download JSON Backup** action for Admin. Academics and Teachers must receive an authorization error and must not see or trigger the action. Exporting does not mutate application data, create a backup record, or require a background job.

### 1.13 Global Search

Admin and Academics receive one shared **Search school data** entry point in the dashboard shell. It opens a keyboard-accessible overlay with a debounced query field, loading state, error state, empty state, and links to matching records. The search result shows the real entity type, title, useful identifying context, and a destination route.

Search covers active Students, active Teachers, Class/Section records, Subjects, Fee Challans, and Tests for Admin and Academics. Admin additionally receives Daily Agenda matches because Daily Agenda is Admin-only. Teachers do not receive this school-wide search entry point and must continue using their existing assignment-scoped workflows. Search results must never expose inactive students or inactive teacher accounts, and the server enforces the role boundary rather than relying on hidden UI alone.

### 1.14 Future-Date Validation

All historical/data-entry dates use the school's current local date as their maximum where applicable. Student DOB and admission date, student and teacher attendance, Daily Agenda, salary-slip periods, fee payment dates, and Fee Ledger issuance filters cannot select or submit future dates. Fee challan issuance is server-generated at creation time and is not client-supplied. From/To pairs must preserve chronological order. Test dates follow the existing application convention and remain capped by their current validation.

### 1.15 Design-System Completion Pass

The final UI refinement pass must preserve the locked industrial/minimal visual language: the existing colors, fonts, square corners, 1px border separation, Lucide icon system, and restrained motion remain unchanged. The implementation should standardize subtle hover and visible keyboard-focus feedback across lists, tables, forms, navigation, dropdowns, dialogs, and custom interactive controls without introducing decorative gradients, rounded cards, or heavy shadows.

Every reviewed surface must retain usable loading, empty, error, disabled, and real-content states where applicable. Status indicators must continue to pair color with an icon or shape. Desktop and mobile verification must capture at least five interaction types, including a list or table row hover/focus state, a primary action button, a form control, a dropdown or dialog, and a loading/empty/error state. The pass is complete only after screenshots show the refined states on real application routes and no out-of-scope visual-system changes are introduced.

---

## 1A. Academics

Multiple accounts — staff delegated to handle certificate and fee challan generation, without full admin privileges.

### 1A.1 Permissions

Academics users can:
- Generate **Leaving Certificates** and **Character Certificates** for students (same flow as Admin, see §1.8)
- Generate **Fee Challans** for students, including adding fee line items and printing (same flow as Admin, see §1.9)
- **Read and edit student attendance** — Academics can view any class's attendance and edit any attendance record (draft or locked). Every edit produces an immutable audit log entry (see §7). Academics **cannot** delete attendance records.
- **Mark and edit teacher attendance — full parity with Admin** (scope amendment v10): Academics can mark Present/Absent/Leave, log reporting time, and log off time via the same `/admin/teacher-attendance` page and `/api/teacher-attendance` endpoint as Admin. Verified: Academics 201 on mark + off-time, Teacher 403.
- **Read-only oversight** of: student lists, attendance records, tests, marks, and report cards — to provide context when generating certificates and challans (unchanged)

### 1A.2 Boundaries

Academics **cannot**:
- Manage user accounts (Admin, Teacher, or other Academics)
- Create or edit classes, sections, or subjects
- Assign or unassign Class Teachers or Subject Teachers
- Edit global Bank Settings (Admin-only per §1.9)
- Mark or confirm **student** attendance (Teacher-specific action)
- Create tests, enter marks, or generate report cards
- View the attendance audit trail (Admin-only per §7)
- Access the Daily Agenda feature (neither read nor write — see §1.11 and §2.5)

### 1A.3 Account Management

Academics accounts are managed exclusively by Admin:
- Admin can create, edit, revoke (disable login), and delete Academics accounts
- Admin can directly reset an Academics user's password
- Required fields: Name, CNIC, Phone, Email, Password (set by Admin at creation)

Admin retains full authority to perform every action an Academics user can — Academics is a delegation, not a separate permission layer.

---

## 2. Teachers

Multiple accounts, scoped to assignments. Two assignment types: Class Teacher (one active per class+section, holds attendance rights) and Subject Teacher (per class+subject, holds test/marks/report-card rights).

### 2.1 Attendance Marking

Class Teachers mark student attendance for their assigned class: draft → confirm (lock). Once locked, only Admin or Academics can edit the record (see §1.5). CSV export available for the teacher's own class.

The teacher attendance page only shows classes where the teacher is the active Class Teacher — not classes where they are only a Subject Teacher. This ensures the attendance UI matches the actual permission scope.

### 2.2 Tests & Marks

Subject Teachers create tests (title, date, max marks) scoped to their class+subject assignment, then enter marks per student against each test.

### 2.3 Report Card Generation

The active Class Teacher generates report cards: selects a student, creates/selects a Term, picks which tests count (multi-select across subjects within the class), and generates an aggregate report card.

### 2.4 Report Card — Template-Based Print

Report card print output uses a **template** configured by Admin (see §3). The template includes:

- **Single fields:** studentName, classSection, termName
- **Table Region:** a variable-length area for test rows. Columns: subject, testTitle, marksObtained, maxMarks. Admin places the table region once (anchor position + row height + column x-positions); the renderer lays out N rows starting at the anchor, incrementing y by rowHeight per row.

The teacher's generation flow (term, test selection) is unchanged — only the print/output step uses the template renderer.

### 2.5 Daily Agenda

A per-teacher, per-class+subject, per-day log. Teachers write agenda entries describing what was covered in a lesson; Admin has read-only visibility across all teachers.

**Granularity:** One agenda entry per teacher, per class+subject, per day. A teacher teaching Math to Grade 5-A and Science to Grade 6-B writes two separate entries on the same date. This matches the SubjectTeacherAssignment model — each entry is scoped to exactly one (teacher, classSection, subject, date) tuple.

**Permission model:** Only the Subject Teacher assigned to that class+subject combination can create or edit an entry — same permission model as Tests & Marks (§2.2). Verified via `SubjectTeacherAssignment` lookup, identical to `requireSubjectTeacher()`.

**Date-based locking (no manual lock):** An entry is editable if its date is today or in the future. It becomes read-only automatically once its date is in the past. There is no confirm/lock action and no stored lock flag — this is enforced server-side by comparing the entry's date against the current date on every write attempt (POST create and PATCH update). Teachers can write entries for future dates (planning ahead) as well as today. Any past entry can be read (by the teacher who wrote it, and by Admin) but not edited once its date has passed.

**Timezone:** "Today" is computed using `Asia/Karachi` (PKT, UTC+5) as the school's local timezone. The helper `getTodayLocal()` in `lib/timezone.ts` returns today's date string in `YYYY-MM-DD` format using this fixed offset, regardless of the server's system timezone. This prevents date-boundary bugs where a server in UTC would "lose" an extra hour and potentially lock entries prematurely. The school's local timezone is hardcoded rather than configurable because this is a single-school-per-deployment system and all existing date-handling code uses server-local `new Date()` which already has similar implicit assumptions — this makes the behavior explicit and testable.

**Content:** Free-text field (up to 5,000 characters). No structured curriculum mapping — this is a quick lesson log, not a formal syllabus tracker.

**Uniqueness:** A database unique constraint on (teacherId, classSectionId, subjectId, date) prevents duplicate entries. Writing again for an existing date updates the existing row, not creating a new one.

**Implementation note:** One shared server-side helper `isDateLocked(dateStr: string): boolean` enforces the locking rule. This helper is called by both the create (POST) and update (PATCH) routes, so the "is this locked" rule cannot drift between the two code paths.

---

## 3. Document Templates

Admin-configured templates control the print layout of Certificates, Report Cards, and Fee Challans. Templates are visual — Admin uploads a background image and places data fields on it.

### 3.1 Template Lifecycle

1. Admin uploads a template image (PNG/JPG) or PDF (converted client-side to an image via pdf.js rendering to canvas, then uploaded as PNG).
2. Admin uses a visual editor to place fields at percentage-based coordinates on the template background.
3. Positions are saved and reused for every future document of that type.
4. Templates are **versioned**: each generated document records which template version was active when it was created. Changing the active template does not reflow historical documents.

### 3.2 Template Types

| Type | Enum | Fields | Table Region |
|---|---|---|---|
| Leaving Certificate | `LEAVING_CERTIFICATE` | studentName, guardianName, classSection, admissionDate, dateOfLeaving, dob, issueDate | No |
| Character Certificate | `CHARACTER_CERTIFICATE` | studentName, guardianName, classSection, dob, conductRemark, issueDate | No |
| Report Card | `REPORT_CARD` | studentName, classSection, termName | Yes (subject, testTitle, marksObtained, maxMarks) |
| Fee Challan | `FEE_CHALLAN` | studentName, guardianName, guardianCnic, classSection, bankName, bankAccountNumber, issueDate, total | Yes (description, amount) |

### 3.3 Fee Challan Template — Three Copies

The Fee Challan template is the **full page**. Admin manually places fields **three times** — once per copy (Bank Copy, Student Copy, School Copy). There is **no auto-triplication** of positions. The same field key can have multiple position records (e.g. `studentName` placed at three different x/y coordinates for the three copies).

### 3.4 Table Regions

Report Card and Fee Challan need a second placement type beyond single fields: a **Table Region**. This is defined by:
- Anchor position (x%, y%)
- Row height (in % of template height)
- Column definitions: array of { fieldKey, x% } — the x position for each column

The renderer lays out N rows starting at the anchor, incrementing y by rowHeight per row, placing each column's value at its defined x position.

### 3.5 Rendering Approach

A shared print view component fetches the active (or document-specific, per templateId snapshot) template, its field positions, and the actual document data. It renders:
1. The background image via CSS
2. Absolutely-positioned text at saved percentage coordinates on top of it
3. For table regions: N rows starting at the anchor, incrementing y by rowHeight per row

This is one shared rendering component parameterized by document type — but the table-region layout logic is genuinely different from single-field layout, so they use separate code paths internally.

### 3.6 Graceful Fallback

If no active template exists for a document type, the print view shows: "No template configured — ask your Admin to upload one in Settings" instead of crashing or rendering blank.

### 3.7 Upload/Storage Requirements

All file uploads (school logo, document templates) use **Vercel Blob** storage. The `BLOB_READ_WRITE_TOKEN` environment variable must be configured in the Vercel Production environment for uploads to function.

**Upload validation (applies to all upload endpoints):**
- MIME type validation: only allowed file types are accepted
- File size validation: maximum sizes are enforced (2MB for logo, 10MB for templates)
- Authorization: only authorized roles can upload (Admin for logo and templates)
- Error handling: clear error messages for invalid types, oversized files, missing tokens, and network failures

**Uploaded assets:**
- School logo: stored as a public Blob URL, displayed in print layouts and the settings UI. Previous logos are deleted when a new one is uploaded.
- Document templates: stored as public Blob URLs (both original file and background image). Templates are versioned — already-generated documents reference the template version active at generation time.

---

## 4. Attendance Audit Trail

Every attendance edit by Admin or Academics produces an **immutable audit record**. Audit records cannot be edited or deleted through the application.

### 4.1 What Is Recorded

Each audit entry contains:
- The attendance record that was changed
- The user who performed the change (by user ID and name)
- The user's role (ADMIN or ACADEMICS)
- The previous attendance status (PRESENT, ABSENT, or LEAVE)
- The new attendance status
- The timestamp of the change

### 4.2 Access Control

- **Admin** can view the full audit history (any class, any date, any student)
- **Academics** can edit attendance but **cannot** view the audit history
- **Teachers** cannot view or interact with audit records

### 4.3 Immutability

Audit records are write-once. There is no application-level API to edit or delete audit entries. The database schema enforces a one-to-one relationship between an attendance edit and its audit entry.

---

## 5. CSV Exports

All CSV exports throughout the LMS include **school metadata** as header rows above the data table. This ensures every exported file is self-identifying.

### 5.1 Metadata Header Format

Every CSV export includes these header rows (when school settings are configured):

```
School: [school name]
Address: [school address]
Phone: [school phone]
Generated By: [user name]
Role: [user role]
Generated At: [YYYY-MM-DD HH:MM:SS]
```

The metadata is placed **above** the data table as separate rows. The data table itself remains a clean CSV that opens correctly in spreadsheet applications.

### 5.2 Supported Exports

| Export | Access | Filters |
|---|---|---|
| Student Attendance CSV | Admin, Academics, Teacher (own class) | classSectionId, date |
| Teacher Attendance CSV | Admin, Academics | teacherId, from, to |

Both exports respect the current filter selections in the UI.
