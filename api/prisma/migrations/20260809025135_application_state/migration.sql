-- The state an applicant trades in, carried onto the vendor on approval.
ALTER TABLE "vendor_applications" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'Lagos';
