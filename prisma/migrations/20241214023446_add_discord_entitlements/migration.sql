-- CreateTable
CREATE TABLE "discord_entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guildId" TEXT,
    "skuId" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6),

    CONSTRAINT "discord_entitlement_pkey" PRIMARY KEY ("id")
);
