import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { institutionBySlug } from "@/lib/auth/authz";

export const dynamic = "force-dynamic";

export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const inst = await institutionBySlug(slug);
  if (inst && inst.slug !== slug) {
    const path = (await headers()).get("x-hl-path") || `/${slug}`;
    redirect(safeAliasPath(slug, inst.slug, path));
  }
  return children;
}

function safeAliasPath(slug: string, target: string, path: string) {
  if (!path.startsWith(`/${slug}`) || path.includes("\\") || path.includes("//")) return `/${target}`;
  const rest = path.slice(slug.length + 1);
  if (rest !== "" && !rest.startsWith("/") && !rest.startsWith("?")) return `/${target}`;
  return `/${target}${rest}`;
}
