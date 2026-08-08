-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('MOTORBIKE', 'BICYCLE', 'TRICYCLE', 'CAR', 'VAN', 'FOOT');

-- AlterTable
ALTER TABLE "riders" ADD COLUMN     "vehicleType" "VehicleType";
