-- AlterTable
ALTER TABLE "servers" ADD COLUMN     "trelloRole" VARCHAR(255);

-- RenameIndex
ALTER INDEX "servers.serverID_unique" RENAME TO "servers_serverID_key";

-- RenameIndex
ALTER INDEX "users.userID_unique" RENAME TO "users_userID_key";
