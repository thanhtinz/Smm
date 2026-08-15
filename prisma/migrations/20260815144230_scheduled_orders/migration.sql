-- AlterTable
ALTER TABLE "Order" ADD COLUMN "startAt" DATETIME;

-- CreateIndex
CREATE INDEX "Order_status_startAt_idx" ON "Order"("status", "startAt");
