import { prisma } from "@/lib/prisma";
import { linkFor, sendMail } from "@/lib/mail";

export async function notifyMembers(institutionId: string, subject: string, text: string, path: string) {
  const [members, prefs] = await Promise.all([
    prisma.membership.findMany({ where: { institutionId }, include: { user: { select: { id: true, email: true } } } }),
    prisma.alertPreference.findMany({ where: { institutionId } }),
  ]);
  const off = new Set(prefs.filter((pref) => !pref.email).map((pref) => pref.userId));
  const link = linkFor(path);
  await Promise.all(members.map(async (member) => {
    if (off.has(member.userId) || !member.user.email) return;
    try {
      await sendMail(member.user.email, subject, `${text}\n${link}`, link);
    } catch (error) {
      console.warn("[mail] timetable notice skipped", error instanceof Error ? error.message : error);
    }
  }));
}
