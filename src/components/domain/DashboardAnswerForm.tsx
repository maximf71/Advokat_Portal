"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DashboardAnswerForm({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    const res = await fetch("/api/dashboard/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, body }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setBody("");
      router.refresh();
    }
  }

  if (done) {
    return <p className="mt-2 text-sm text-registry-green">Ответ опубликован</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      <Textarea
        placeholder="Ваш ответ клиенту…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button type="button" size="sm" disabled={busy} onClick={submit}>
        Ответить
      </Button>
    </div>
  );
}
