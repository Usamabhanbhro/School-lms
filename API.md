# School LMS — API Reference

Living document. Every API route must be added here when created — see `CONVENTIONS.md` and `AGENTS.md`. This is a scaffold; routes below are illustrative/anticipated pending `SRS.md`, not yet implemented.

## Conventions Recap

- REST-shaped, resource-based paths, plural nouns: `/api/students`, not `/api/getStudents`
- Auth: session-based (NextAuth), every route checks role before executing
- Success response: `{ "data": ... }`
- Error response: `{ "error": { "message": "...", "code": "..." } }`

## Format for Each Entry

```
### METHOD /api/resource
**Role required:** Admin | Teacher | Student | Parent | Any authenticated
**Purpose:** one line
**Request body:** shape (if applicable)
**Response:** shape
**Notes:** edge cases, rate limits, etc.
```

---

## Auth

### POST /api/auth/[...nextauth]
Handled by NextAuth — login/logout/session, not manually documented route-by-route here. See `lib/auth.ts` for provider config.
**Status:** implemented (skeleton) — Credentials provider against the `users` table, JWT sessions.

---

## Users (Admin-managed)

### GET /api/users
**Role required:** Admin
**Purpose:** List users
**Response:** `{ data: [{ id, username, email, name, role, isActive, createdAt }] }`
**Status:** implemented (skeleton)

### POST /api/users
**Role required:** Admin
**Purpose:** Create a user (admin, teacher, student, parent)
**Request body:** `{ username, email?, name, password, role }`
**Response (201):** `{ data: { id, username, email, name, role, isActive, createdAt } }`
**Status:** implemented (skeleton) — establishes the `requireRole()` + Zod validation pattern every route follows

---

## Attendance

### GET /api/attendance
**Role required:** Teacher (own classes), Admin (all), Parent (own child), Student (self)
**Purpose:** Fetch attendance records, filterable by class/date range/student
**Notes:** highest-traffic endpoint, expect mobile use — keep payload lean, paginate by date range

### POST /api/attendance
**Role required:** Teacher
**Purpose:** Mark attendance for a class/date
**Request body:** `{ classSectionId, date, records: [{ studentId, status }] }`
**Notes:** should be idempotent — re-submitting the same date/class updates rather than duplicates

---

## Grades

### GET /api/grades
**Role required:** Teacher (own classes), Admin (all), Parent/Student (own)
**Purpose:** Fetch grades, filterable by subject/term/student

### POST /api/grades
**Role required:** Teacher
**Purpose:** Submit/update a grade
**Request body:** `{ studentId, subjectId, value, maxValue, type }`

---

## Assignments

### GET /api/assignments
**Role required:** Any authenticated (scoped to relevant class)

### POST /api/assignments
**Role required:** Teacher
**Request body:** `{ classSectionId, subjectId, title, description, dueDate }`

### POST /api/assignments/:id/submissions
**Role required:** Student
**Purpose:** Submit work for an assignment

---

## Timetable

### GET /api/timetable
**Role required:** Any authenticated (scoped to relevant class/teacher)

---

## Announcements

### GET /api/announcements
**Role required:** Any authenticated (scoped to school/class/individual)

### POST /api/announcements
**Role required:** Admin, Teacher

---

## Not Yet Scoped (pending SRS)

- Fee management endpoints
- Library management endpoints
- File upload endpoints (pending storage provider decision in `ARCHITECTURE.md`)
- Report/PDF export endpoints (report cards, attendance sheets)

## Rate Limiting / Abuse Prevention

TBD — not yet decided. Revisit once SRS defines expected usage patterns (e.g. how many concurrent teachers marking attendance during peak hours).
