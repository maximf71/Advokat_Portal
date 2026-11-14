"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Неверный email или пароль");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md border border-rule bg-surface p-6">
      <p className="section-kicker mb-2">Вход</p>
      <h1 className="font-serif text-3xl">Личный кабинет</h1>
      <p className="mt-2 text-sm text-muted-ink">
        Демо: admin@portal.local / admin123 или lawyer-аккаунты из seed.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="password">Пароль</Label>
          <Input id="password" name="password" type="password" required className="mt-1" />
        </div>
        {error && <p className="text-sm text-bronze">{error}</p>}
        <Button type="submit" size="full" disabled={loading}>
          {loading ? "Вход…" : "Войти"}
        </Button>
      </form>
    </div>
  );
}
