import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";

/**
 * Resolve the TeacherProfile for the current session user.
 * Throws 404 if no profile exists (shouldn't happen for valid teacher accounts).
 */
export async function getTeacherProfile(userId: string) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    throw new ApiError(404, "NOT_FOUND", "Teacher profile not found.");
  }
  return profile;
}

/**
 * Get the class section IDs a teacher is assigned to (as Class Teacher or Subject Teacher).
 * Used for RBAC scoping: Admin sees everything, Teacher sees only their own.
 * Returns undefined for Admin (no filtering needed), or an array of allowed IDs for Teacher.
 *
 * Only active ClassTeacherAssignments are included (isActive = true).
 */
export async function getScopedClassSectionIds(
  session: Session,
): Promise<string[] | undefined> {
  if (session.user.role === "ADMIN") return undefined; // no filter

  const profile = await getTeacherProfile(session.user.id);

  // Gather all class section IDs from both assignment types
  // ClassTeacherAssignment: only active assignments count
  const [classAssignments, subjectAssignments] = await Promise.all([
    prisma.classTeacherAssignment.findMany({
      where: { teacherId: profile.id, isActive: true },
      select: { classSectionId: true },
    }),
    prisma.subjectTeacherAssignment.findMany({
      where: { teacherId: profile.id },
      select: { classSectionId: true },
    }),
  ]);

  const ids = new Set([
    ...classAssignments.map((a) => a.classSectionId),
    ...subjectAssignments.map((a) => a.classSectionId),
  ]);

  return Array.from(ids);
}
