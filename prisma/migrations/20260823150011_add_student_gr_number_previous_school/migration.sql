-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "grNumber" TEXT,
ADD COLUMN     "previousSchool" TEXT,
ALTER COLUMN "placeOfBirth" DROP DEFAULT,
ALTER COLUMN "guardianContact" DROP DEFAULT,
ALTER COLUMN "address" DROP DEFAULT;
