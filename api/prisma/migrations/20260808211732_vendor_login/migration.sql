-- Vendors become a third kind of user: they sign in by phone with an OTP,
-- exactly as customers and riders do.

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'VENDOR_LOGIN';

-- CreateIndex
-- Every vendors.phone is NULL today, and Postgres permits many NULLs under a
-- unique index, so this cannot conflict with existing rows.
CREATE UNIQUE INDEX "vendors_phone_key" ON "vendors"("phone");
