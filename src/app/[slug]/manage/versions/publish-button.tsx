"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

function csrfToken() {
  const match = document.cookie.match(/(?:^|; )hl_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function PublishButton({ slug, id }: { slug: string; id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        size="sm"
        type="button"
        onClick={async () => {
          setError("");
          const res = await fetch(`/api/i/${slug}/versions/${id}/publish`, {
            method: "POST",
            headers: { "x-csrf-token": csrfToken() },
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Publish failed");
            return;
          }
          router.refresh();
        }}
      >
        Publish
      </Button>
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
