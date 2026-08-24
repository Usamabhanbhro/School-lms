import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

const RESULT_LIMIT = 8;

type SearchResult = {
  type: "Student" | "Teacher" | "Class" | "Subject" | "Fee Challan" | "Test" | "Agenda";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/**
 * GET /api/search?q=...
 * One school-wide search endpoint with role-aware scopes.
 * Admin and Academics can search operational school data; Teachers are kept
 * scoped to their existing assigned-class surfaces and are not included here.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = requireRole(session, ["ADMIN", "ACADEMICS"]);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (!query) return NextResponse.json({ data: { query, results: [] } });

    const contains = { contains: query, mode: "insensitive" as const };
    const [students, teachers, classes, subjects, challans, tests, agenda] = await Promise.all([
      prisma.student.findMany({
        where: {
          isActive: true,
          OR: [
            { name: contains },
            { guardianName: contains },
            { studentId: contains },
            { grNumber: contains },
          ],
        },
        select: { id: true, name: true, studentId: true, guardianName: true, classSection: { select: { className: true, sectionName: true } } },
        orderBy: { name: "asc" },
        take: RESULT_LIMIT,
      }),
      prisma.teacherProfile.findMany({
        where: {
          user: { isActive: true },
          OR: [{ name: contains }, { fatherOrSpouseName: contains }, { cnic: contains }, { phone: contains }, { email: contains }],
        },
        select: { id: true, name: true, phone: true, email: true },
        orderBy: { name: "asc" },
        take: RESULT_LIMIT,
      }),
      prisma.classSection.findMany({
        where: { OR: [{ className: contains }, { sectionName: contains }] },
        select: { id: true, className: true, sectionName: true },
        orderBy: [{ className: "asc" }, { sectionName: "asc" }],
        take: RESULT_LIMIT,
      }),
      prisma.subject.findMany({
        where: { name: contains },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: RESULT_LIMIT,
      }),
      prisma.feeChallan.findMany({
        where: {
          OR: [
            { studentNameSnapshot: contains },
            { guardianNameSnapshot: contains },
            { classSectionSnapshot: contains },
            { bankNameSnapshot: contains },
          ],
        },
        select: { id: true, studentId: true, studentNameSnapshot: true, classSectionSnapshot: true, issuedDate: true, total: true },
        orderBy: { issuedDate: "desc" },
        take: RESULT_LIMIT,
      }),
      prisma.test.findMany({
        where: { title: contains },
        select: { id: true, title: true, date: true, classSection: { select: { className: true, sectionName: true } }, subject: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: RESULT_LIMIT,
      }),
      user.user.role === "ADMIN"
        ? prisma.dailyAgenda.findMany({
            where: { content: contains },
            select: { id: true, content: true, date: true, classSection: { select: { className: true, sectionName: true } }, subject: { select: { name: true } } },
            orderBy: { date: "desc" },
            take: RESULT_LIMIT,
          })
        : Promise.resolve([]),
    ]);

    const results: SearchResult[] = [
      ...students.map((student) => ({ type: "Student" as const, id: student.id, title: student.name, subtitle: [student.studentId, `${student.classSection.className} - ${student.classSection.sectionName}`, `Guardian: ${student.guardianName}`].filter(Boolean).join(" · "), href: `/admin/students?studentId=${encodeURIComponent(student.id)}` })),
      ...teachers.map((teacher) => ({ type: "Teacher" as const, id: teacher.id, title: teacher.name, subtitle: [teacher.phone, teacher.email].filter(Boolean).join(" · "), href: `/admin/teachers?teacherId=${encodeURIComponent(teacher.id)}` })),
      ...classes.map((section) => ({ type: "Class" as const, id: section.id, title: `${section.className} - ${section.sectionName}`, subtitle: "Class / section", href: `/admin/classes?classSectionId=${encodeURIComponent(section.id)}` })),
      ...subjects.map((subject) => ({ type: "Subject" as const, id: subject.id, title: subject.name, subtitle: "Subject", href: `/admin/subjects?subjectId=${encodeURIComponent(subject.id)}` })),
      ...challans.map((challan) => ({ type: "Fee Challan" as const, id: challan.id, title: challan.studentNameSnapshot, subtitle: `${challan.classSectionSnapshot} · Rs. ${challan.total.toLocaleString()} · ${new Date(challan.issuedDate).toLocaleDateString()}`, href: `/admin/fees?studentId=${encodeURIComponent(challan.studentId)}&challanId=${encodeURIComponent(challan.id)}` })),
      ...tests.map((test) => ({ type: "Test" as const, id: test.id, title: test.title, subtitle: `${test.classSection.className} - ${test.classSection.sectionName} · ${test.subject.name} · ${new Date(test.date).toLocaleDateString()}`, href: `/admin/tests?testId=${encodeURIComponent(test.id)}` })),
      ...agenda.map((entry) => ({ type: "Agenda" as const, id: entry.id, title: entry.content.slice(0, 90), subtitle: `${entry.classSection.className} - ${entry.classSection.sectionName} · ${entry.subject.name} · ${new Date(entry.date).toLocaleDateString()}`, href: `/admin/agenda?entryId=${encodeURIComponent(entry.id)}` })),
    ];

    return NextResponse.json({ data: { query, results } });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
