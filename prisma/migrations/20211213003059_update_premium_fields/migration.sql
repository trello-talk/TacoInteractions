/*
  Warnings:

  - You are about to drop the column `premium` on the `servers` table. All the data in the column will be lost.
  - You are about to drop the column `premium` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "servers" DROP COLUMN "premium";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "premium",
ADD COLUMN     "premiumTrelloToken" VARCHAR(255);

-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "premium" BOOLEAN NOT NULL DEFAULT false;
