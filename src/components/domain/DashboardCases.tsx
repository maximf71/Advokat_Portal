"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CaseItem = {
  id: string;
  caseNumber: string;
  title: string;
  summary: string | null;
  outcome: string;
  isHiddenByLawyer: boolean;
  court: { name: string } | null;
};

export function DashboardCases({ cases }: { cases: CaseItem[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  async function patch(id: string, data: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/dashboard/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {cases.map((c) => (
        <div
          key={c.id}
          className={`border border-rule bg-surface p-4 ${c.isHiddenByLawyer ? "opacity-60" : ""}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-navy">{c.caseNumber}</p>
              <p className="font-medium">{c.title}</p>
              <p className="text-xs text-muted-ink">
                {c.court?.name ?? "Суд не указан"} · {c.outcome}
                {c.isHiddenByLawyer ? " · скрыто" : ""}
              </p>
              {c.summary && <p className="mt-2 text-sm text-muted-ink">{c.summary}</p>}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditingId(c.id);
                  setSummary(c.summary ?? "");
                }}
              >
                Описание
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => patch(c.id, { isHiddenByLawyer: !c.isHiddenByLawyer })}
              >
                {c.isHiddenByLawyer ? "Показать" : "Скрыть"}
              </Button>
            </div>
          </div>
          {editingId === c.id && (
            <div className="mt-3 space-y-2">
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} />
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  patch(c.id, { summary, isVerifiedByLawyer: true })
                }
              >
                Сохранить
              </Button>
            </div>
          )}
        </div>
      ))}
      {cases.length === 0 && (
        <p className="border border-rule bg-surface px-4 py-6 text-sm text-muted-ink">
          Дел пока нет
        </p>
      )}
    </div>
  );
}
