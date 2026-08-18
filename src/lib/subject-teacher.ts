import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/rbac";

/**
 * Verify that the given teacher profile holds an active SubjectTeacherAssignment
 * for the specified classSectionId + subjectId combination. Throws 403 if not.
 *
 * Returns the SubjectTeacherAssignment if valid.
 */
export async function requireSubjectTeacher(
  teacherProfileId: string,
  classSectionId: string,
  subjectId: string,
) {
  const assignment = await prisma.subjectTeacherAssignment.findFirst({
    where: {
      classSectionId,
      subjectId,
      teacherId: teacherProfileId,
    },
  });

  if (!assignment) {
    throw new ApiError(
      403,
      "NOT_SUBJECT_TEACHER",
      "You are not assigned as a subject teacher for this class and subject.",
    );
  }

  return assignment;
}
