import { notFound, redirect } from "next/navigation";
import { fieldClass, FormCard } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { deleteRoomAction, roomAction } from "@/lib/actions/institution";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function RoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  try {
    const { inst } = await requireRole(slug, "ADMIN");
    const [rooms, shell] = await Promise.all([
      prisma.room.findMany({ where: { institutionId: inst.id }, orderBy: { name: "asc" } }),
      shellData(),
    ]);
    return (
      <AppShell title="Rooms" subtitle="Unknown rooms in a CSV are warnings. They are not renamed." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
        {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
        <ul className="mb-8 space-y-2">
          {rooms.map((room) => (
            <li key={room.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
              <div>
                <p className="font-semibold">{room.name}</p>
                <p className="text-[12px] text-muted">
                  {room.building || "No building"} · {room.capacity} seats · {room.isLab ? "Lab" : "Classroom"}
                  {room.floor != null ? ` · Floor ${room.floor}` : ""}
                  {room.hasProjector ? " · Projector" : ""}
                  {room.hasSmartBoard ? " · Smart board" : ""}
                  {room.hasAc ? " · AC" : ""}
                </p>
              </div>
              <form action={deleteRoomAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={room.id} />
                <button className="text-[13px] text-danger" type="submit">Remove</button>
              </form>
            </li>
          ))}
        </ul>
        <div className="max-w-md">
          <h2 className="mb-3 text-[17px] font-semibold">Add a room</h2>
          <FormCard action={roomAction} submit="Save room">
            <input type="hidden" name="slug" value={slug} />
            <input className={fieldClass} name="name" required placeholder="Name" />
            <input className={fieldClass} name="building" placeholder="Building" />
            <input className={fieldClass} name="capacity" type="number" min={1} defaultValue={60} required />
            <input className={fieldClass} name="floor" type="number" min={0} max={30} placeholder="Floor" />
            <label className="flex items-center gap-2 text-[14px]"><input name="isLab" type="checkbox" /> Lab</label>
            <label className="flex items-center gap-2 text-[14px]"><input name="hasProjector" type="checkbox" /> Projector</label>
            <label className="flex items-center gap-2 text-[14px]"><input name="hasSmartBoard" type="checkbox" /> Smart board</label>
            <label className="flex items-center gap-2 text-[14px]"><input name="hasAc" type="checkbox" /> AC</label>
          </FormCard>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(`/login?next=/${slug}/manage/rooms`);
    notFound();
  }
}
