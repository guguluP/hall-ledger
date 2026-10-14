import { notFound, redirect } from "next/navigation";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";

export const dynamic = "force-dynamic";

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    await requireRole(slug, "VIEWER");
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(`/login?next=/${slug}/manage`);
    notFound();
  }
  return children;
}
