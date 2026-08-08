-- CreateEnum
CREATE TYPE "VendorApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "vendor_applications" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "contactName" TEXT,
    "note" TEXT,
    "status" "VendorApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "applicantId" TEXT,
    "vendorId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_applications_vendorId_key" ON "vendor_applications"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_applications_status_createdAt_idx" ON "vendor_applications"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "vendor_applications" ADD CONSTRAINT "vendor_applications_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_applications" ADD CONSTRAINT "vendor_applications_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
