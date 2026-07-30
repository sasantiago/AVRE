-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DELINQUENT', 'WITHDRAWAL_PENDING', 'CLOSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "advisorId" UUID;

-- CreateIndex
CREATE INDEX "User_advisorId_idx" ON "User"("advisorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
