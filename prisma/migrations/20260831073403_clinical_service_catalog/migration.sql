-- CreateEnum
CREATE TYPE "ClinicalServiceType" AS ENUM ('CONSULTATION', 'LAB');

-- CreateTable
CREATE TABLE "ClinicalService" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClinicalServiceType" NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalService_code_key" ON "ClinicalService"("code");

-- CreateIndex
CREATE INDEX "ClinicalService_type_active_name_idx" ON "ClinicalService"("type", "active", "name");

-- CreateIndex
CREATE INDEX "ClinicalService_departmentId_type_active_idx" ON "ClinicalService"("departmentId", "type", "active");

-- AddForeignKey
ALTER TABLE "ClinicalService" ADD CONSTRAINT "ClinicalService_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
