import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function formatPrice(n: number): string {
  return `${formatNumber(n)} ₽`;
}

export function experienceYears(startYear: number | null | undefined): number | null {
  if (!startYear) return null;
  return Math.max(0, new Date().getFullYear() - startYear);
}

export function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("");
}
