import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { applyDemoRoomRules, isLabRoom, type DemoRoomRules } from "../src/lib/rooms";
import { detectHardConflicts, type SlotIn } from "../src/lib/parse/timetable";
import { parseTimeToMinutes } from "../src/lib/time";
import { DEMO_SECTIONS } from "../src/lib/students";

const prisma = new PrismaClient();
const fixtureDir = path.join(__dirname, "fixtures");

type SeedSlot = {
  classroomName: string;
  sectionName: string | null;
  subjectName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

async function main() {
  const timetable = JSON.parse(readFileSync(path.join(fixtureDir, "default-timetable.json"), "utf8")) as {
    fileName?: string;
    slots: SeedSlot[];
    rooms: { name: string; building?: string; capacity?: number }[];
  };
  const rules = JSON.parse(readFileSync(path.join(fixtureDir, "demo-room-rules.json"), "utf8")) as DemoRoomRules & {
    labs?: string[];
  };
  const labs = new Set(rules.labs || []);

  const email = (process.env.SEED_OWNER_EMAIL || "owner@demo.hallledger.test").toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD || "DemoOwner-2026";
  const passwordHash = await hashPassword(password);
  const owner = await prisma.user.upsert({
    where: { email },
    update: { emailVerifiedAt: new Date(), passwordHash, name: "Demo owner" },
    create: { email, name: "Demo owner", passwordHash, emailVerifiedAt: new Date() },
  });

  const existing = await prisma.institution.findUnique({ where: { slug: "demo" } });
  if (existing) {
    await prisma.institution.delete({ where: { id: existing.id } });
  }

  const inst = await prisma.institution.create({
    data: { slug: "demo", name: "Aryabhatta & Kautalya", isPublic: true },
  });
  await prisma.membership.create({
    data: { institutionId: inst.id, userId: owner.id, role: "OWNER" },
  });

  const roomIds = new Map<string, string>();
  for (const room of timetable.rooms) {
    const name = applyDemoRoomRules(room.name, rules);
    const created = await prisma.room.create({
      data: {
        institutionId: inst.id,
        name,
        building: room.building || null,
        capacity: room.capacity || 60,
        isLab: labs.has(name) || isLabRoom(name),
      },
    });
    roomIds.set(name.toUpperCase(), created.id);
  }

  const slots: SlotIn[] = timetable.slots.map((slot) => ({
    section: slot.sectionName || "SECTION",
    subject: slot.subjectName,
    room: slot.classroomName ? applyDemoRoomRules(slot.classroomName, rules) : null,
    type: "CLASS",
    dayOfWeek: slot.dayOfWeek,
    startMin: parseTimeToMinutes(slot.startTime),
    endMin: parseTimeToMinutes(slot.endTime),
  })).filter((slot) => slot.startMin >= 0 && slot.endMin > slot.startMin);

  const conflicts = detectHardConflicts(slots);
  const table = await prisma.timetable.create({
    data: { institutionId: inst.id, name: "Main" },
  });
  const version = await prisma.timetableVersion.create({
    data: {
      timetableId: table.id,
      status: "PUBLISHED",
      fileName: timetable.fileName || "2025-26 timetable",
      createdById: owner.id,
      publishedAt: new Date("2026-08-31T00:00:00.000Z"),
      conflictCount: conflicts.length,
      warnings: [],
    },
  });
  for (let i = 0; i < slots.length; i += 200) {
    await prisma.slot.createMany({
      data: slots.slice(i, i + 200).map((slot) => ({
        versionId: version.id,
        roomId: slot.room ? roomIds.get(slot.room.toUpperCase()) || null : null,
        roomName: slot.room,
        section: slot.section,
        subject: slot.subject,
        type: slot.type,
        dayOfWeek: slot.dayOfWeek,
        startMin: slot.startMin,
        endMin: slot.endMin,
      })),
    });
  }
  await prisma.timetable.update({ where: { id: table.id }, data: { activeVersionId: version.id } });
  await prisma.sectionStrength.createMany({
    data: DEMO_SECTIONS.map((section) => ({
      institutionId: inst.id,
      section: section.section,
      students: section.students,
    })),
  });
  console.info(`Seeded demo institution with ${slots.length} slots and ${conflicts.length} conflicts.`);
  console.info(`Demo owner ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
