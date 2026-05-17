-- AlterTable
ALTER TABLE "public"."runs" 
ADD COLUMN "settlement_error_code" TEXT,
ADD COLUMN "settlement_error_detail" TEXT;
