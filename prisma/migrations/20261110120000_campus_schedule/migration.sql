-- AlterTable
ALTER TABLE "Institution" ADD COLUMN "dayStartMin" INTEGER NOT NULL DEFAULT 570;
ALTER TABLE "Institution" ADD COLUMN "dayEndMin" INTEGER NOT NULL DEFAULT 1050;
ALTER TABLE "Institution" ADD COLUMN "sundayOpen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "floor" INTEGER;
ALTER TABLE "Room" ADD COLUMN "hasProjector" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Room" ADD COLUMN "hasSmartBoard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Room" ADD COLUMN "hasAc" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Slot" ADD COLUMN "teacher" TEXT;

-- CreateTable
CREATE TABLE "SlugAlias" (
    "slug" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugAlias_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "RetiredRoom" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "RetiredRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Closure" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Closure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleChange" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "section" TEXT,
    "subject" TEXT,
    "teacher" TEXT,
    "roomName" TEXT,
    "fromRoom" TEXT,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrowdReport" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "roomKey" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrowdReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupancyNote" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "occupied" BOOLEAN NOT NULL,
    "headcount" INTEGER,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "OccupancyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertPreference" (
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlertPreference_pkey" PRIMARY KEY ("institutionId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetiredRoom_institutionId_roomKey_key" ON "RetiredRoom"("institutionId", "roomKey");

-- CreateIndex
CREATE INDEX "Closure_institutionId_startDate_idx" ON "Closure"("institutionId", "startDate");

-- CreateIndex
CREATE INDEX "ScheduleChange_institutionId_date_idx" ON "ScheduleChange"("institutionId", "date");

-- CreateIndex
CREATE INDEX "CrowdReport_institutionId_expiresAt_idx" ON "CrowdReport"("institutionId", "expiresAt");

-- CreateIndex
CREATE INDEX "BookingRequest_institutionId_status_idx" ON "BookingRequest"("institutionId", "status");

-- CreateIndex
CREATE INDEX "OccupancyNote_institutionId_observedAt_idx" ON "OccupancyNote"("institutionId", "observedAt");

-- AddForeignKey
ALTER TABLE "SlugAlias" ADD CONSTRAINT "SlugAlias_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiredRoom" ADD CONSTRAINT "RetiredRoom_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Closure" ADD CONSTRAINT "Closure_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChange" ADD CONSTRAINT "ScheduleChange_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdReport" ADD CONSTRAINT "CrowdReport_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupancyNote" ADD CONSTRAINT "OccupancyNote_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertPreference" ADD CONSTRAINT "AlertPreference_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The app connects through Prisma. RLS with no policies keeps the Supabase Data API off these tables.
ALTER TABLE "SlugAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetiredRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Closure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleChange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrowdReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookingRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OccupancyNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AlertPreference" ENABLE ROW LEVEL SECURITY;
