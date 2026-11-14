"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function LeadForm({
  lawyerId,
  cityId,
  categoryId,
  sourceUrl,
}: {
  lawyerId?: string;
  cityId?: string;
  categoryId?: string;
  sourceUrl?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.get("clientName"),
          clientPhone: form.get("clientPhone"),
          problemText: form.get("problemText"),
          lawyerId,
          cityId,
          categoryId,
          sourceUrl: sourceUrl ?? window.location.href,
        }),
      });
      if (!res.ok) throw new Error("fail");
      setStatus("ok");
      setMessage("Заявка отправлена. Мы свяжемся с вами в ближайшее время.");
      e.currentTarget.reset();
    } catch {
      setStatus("error");
      setMessage("Не удалось отправить заявку. Попробуйте ещё раз.");
    }
  }

  return (
    <form id="lead" onSubmit={onSubmit} className="space-y-3 border border-rule bg-surface p-4">
      <p className="section-kicker">Заявка</p>
      <h3 className="font-serif text-xl">Обсудить дело с юристом</h3>
      <div>
        <Label htmlFor="clientName">Имя</Label>
        <Input id="clientName" name="clientName" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="clientPhone">Телефон</Label>
        <Input id="clientPhone" name="clientPhone" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="problemText">Кратко о ситуации</Label>
        <Textarea id="problemText" name="problemText" required className="mt-1" />
      </div>
      <Button type="submit" size="full" disabled={status === "loading"}>
        {status === "loading" ? "Отправка…" : "Отправить заявку"}
      </Button>
      {message && (
        <p className={`text-sm ${status === "ok" ? "text-registry-green" : "text-bronze"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
