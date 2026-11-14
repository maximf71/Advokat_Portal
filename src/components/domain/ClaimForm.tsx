"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ClaimForm({
  lawyerId,
  lawyerName,
}: {
  lawyerId: string;
  lawyerName: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lawyerId,
          applicantName: form.get("applicantName") || lawyerName,
          workEmail: form.get("workEmail"),
          workPhone: form.get("workPhone"),
          idCardScanUrl: form.get("idCardScanUrl"),
          comment: form.get("comment"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "fail");
      setStatus("ok");
      setMessage("Заявка отправлена на модерацию. После одобрения профиль появится в кабинете.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Ошибка отправки");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border border-rule bg-surface p-5">
      <div>
        <Label htmlFor="applicantName">ФИО заявителя</Label>
        <Input id="applicantName" name="applicantName" defaultValue={lawyerName} required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="workEmail">Рабочий email</Label>
        <Input id="workEmail" name="workEmail" type="email" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="workPhone">Рабочий телефон</Label>
        <Input id="workPhone" name="workPhone" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="idCardScanUrl">Ссылка на скан удостоверения</Label>
        <Input
          id="idCardScanUrl"
          name="idCardScanUrl"
          placeholder="https://... или путь к файлу в хранилище"
          required
          className="mt-1"
        />
        <p className="mt-1 text-[11px] text-muted-ink">
          Для локальной разработки достаточно любой URL-заглушки.
        </p>
      </div>
      <div>
        <Label htmlFor="comment">Комментарий</Label>
        <Textarea id="comment" name="comment" className="mt-1" />
      </div>
      <Button type="submit" size="full" disabled={status === "loading" || status === "ok"}>
        {status === "loading" ? "Отправка…" : "Отправить на проверку"}
      </Button>
      {message && (
        <p className={`text-sm ${status === "ok" ? "text-registry-green" : "text-bronze"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
