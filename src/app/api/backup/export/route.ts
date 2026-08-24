import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, requireRole } from "@/lib/rbac";

const BACKUP_SCHEMA_VERSION = "1.0";

/**
 * GET /api/backup/export
 * Admin-only, on-demand, read-only JSON backup of application data.
 * Authentication secrets are intentionally excluded from the bundle.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requireRole(session, ["ADMIN"]);

    const [
      users,
      adminRecoveryCodes,
      teacherProfiles,
      academicsProfiles,
      classSections,
      subjects,
      classTeacherAssignments,
      subjectTeacherAssignments,
      students,
      dailyAgendas,
      studentAttendance,
      teacherAttendance,
      tests,
      marks,
      terms,
      reportCards,
      reportCardTests,
      certificates,
      bankSettings,
      feeChallans,
      salarySlips,
      salarySlipDeductions,
      feeChallanLineItems,
      feeChallanPayments,
      attendanceAuditLogs,
      schoolSettings,
      documentTemplates,
      templateFields,
      templateStaticTexts,
      templateTableRegions,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.adminRecoveryCode.findMany({
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          consumedAt: true,
          replacedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.teacherProfile.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.academicsProfile.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.classSection.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.subject.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.classTeacherAssignment.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.subjectTeacherAssignment.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.student.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.dailyAgenda.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.studentAttendance.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.teacherAttendance.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.test.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.mark.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.term.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.reportCard.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.reportCardTest.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.certificate.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.bankSettings.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.feeChallan.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.salarySlip.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.salarySlipDeduction.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.feeChallanLineItem.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.feeChallanPayment.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.attendanceAuditLog.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.schoolSettings.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.documentTemplate.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.templateField.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.templateStaticText.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.templateTableRegion.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    const exportedAt = new Date();
    const backup = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: exportedAt.toISOString(),
      data: {
        users,
        adminRecoveryCodes,
        teacherProfiles,
        academicsProfiles,
        classSections,
        subjects,
        classTeacherAssignments,
        subjectTeacherAssignments,
        students,
        dailyAgendas,
        studentAttendance,
        teacherAttendance,
        tests,
        marks,
        terms,
        reportCards,
        reportCardTests,
        certificates,
        bankSettings,
        feeChallans,
        salarySlips,
        salarySlipDeductions,
        feeChallanLineItems,
        feeChallanPayments,
        attendanceAuditLogs,
        schoolSettings,
        documentTemplates,
        templateFields,
        templateStaticTexts,
        templateTableRegions,
      },
    };

    const date = exportedAt.toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="school-lms-backup-${date}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json(
      { error: { message: "An internal error occurred.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
