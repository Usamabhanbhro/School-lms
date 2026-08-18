import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";

/**
 * Verify that the given teacher profile is the active Class Teacher
 * for the specified ClassSection. Throws 403 if not.
 *
 * Returns the ClassTeacherAssignment if valid.
 */
export async function requireActiveClassTeacher(
  teacherProfileId: string,
  classSectionId: string,
) {
  const assignment = await prisma.classTeacherAssignment.findFirst({
    where: {
      classSectionId,
      teacherId: teacherProfileId,
      isActive: true,
    },
  });

  if (!assignment) {
    throw new ApiError(
      403,
      "NOT_CLASS_TEACHER",
      "You are not the active class teacher for this class section.",
    );
  }

  return assignment;
}
