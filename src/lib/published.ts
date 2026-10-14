import { unstable_cache } from "next/cache";
import { loadPublishedView } from "@/lib/timetable-repo";

export function getPublished(institutionId: string) {
  return unstable_cache(() => loadPublishedView(institutionId), ["tt", institutionId], {
    tags: [`tt:${institutionId}`],
  })();
}
