-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- Seed the single demo tenant so pre-existing rows have somewhere to land. The
-- app-level seed script (prisma/seed.ts) upserts on this same slug, so this is
-- safe to run alongside it.
INSERT INTO "organizations" ("id", "slug", "name", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'hertz-demo', 'Hertz Studio', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- AlterTable: add as nullable first so existing rows can be backfilled.
ALTER TABLE "users" ADD COLUMN     "organizationId" TEXT;

-- Backfill any pre-existing users (e.g. manually created via /auth/register) into the demo org.
UPDATE "users" SET "organizationId" = (SELECT "id" FROM "organizations" WHERE "slug" = 'hertz-demo')
WHERE "organizationId" IS NULL;

-- Now that every row has a value, enforce NOT NULL.
ALTER TABLE "users" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
