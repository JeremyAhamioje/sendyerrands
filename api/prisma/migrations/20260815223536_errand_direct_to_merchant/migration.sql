-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'QUOTE_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE 'PRICE_PROPOSED';
ALTER TYPE "OrderStatus" ADD VALUE 'MERCHANT_PAID';
ALTER TYPE "OrderStatus" ADD VALUE 'AT_DOORSTEP';

-- AlterTable
ALTER TABLE "errand_details" ADD COLUMN     "actualItemKobo" INTEGER,
ADD COLUMN     "assetSecuredAt" TIMESTAMP(3),
ADD COLUMN     "atDoorstepAt" TIMESTAMP(3),
ADD COLUMN     "merchantAccountName" TEXT,
ADD COLUMN     "merchantAccountNo" TEXT,
ADD COLUMN     "merchantBankCode" TEXT,
ADD COLUMN     "merchantBankName" TEXT,
ADD COLUMN     "merchantPaidAt" TIMESTAMP(3),
ADD COLUMN     "paymentProofUrl" TEXT;

