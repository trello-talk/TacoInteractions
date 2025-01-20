-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "threadID" VARCHAR(255),
ADD COLUMN     "threadParent" VARCHAR(255);
