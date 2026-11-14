import type { RegistryStatus } from "@prisma/client";
import type { RegistryValue } from "./minjust-client";

export type ImportLawyerRow = {
  externalId: string;
  registryNumber: string;
  fullName: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  citySlug: string;
  registryStatus: RegistryStatus;
  identityCardNumber?: string;
  chamberName?: string;
  regionCode?: string;
  officeAddress?: string;
  publicPhone?: string;
  /** How city was resolved for Samara oblast rows */
  cityMatchSource?: "minjust_org" | "paso";
  lawFirmName?: string;
};

const STATUS_MAP: Record<string, RegistryStatus> = {
  Действующий: "ACTIVE",
  Приостановлен: "SUSPENDED",
  Прекращен: "TERMINATED",
  Исключен: "TERMINATED",
  "В процессе изменения членства": "ACTIVE",
};

export function mapRegistryStatus(raw?: string): RegistryStatus {
  if (!raw) return "UNKNOWN";
  return STATUS_MAP[raw.trim()] ?? "UNKNOWN";
}

/** Split "Иванов Иван Иванович" / "Иванова-Петрова Анна" into parts. */
export function parseFullName(fullName: string): {
  lastName: string;
  firstName: string;
  middleName?: string;
} {
  const cleaned = fullName
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 0) {
    return { lastName: "Неизвестно", firstName: "Неизвестно" };
  }
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: parts[0] };
  }
  if (parts.length === 2) {
    return { lastName: parts[0], firstName: parts[1] };
  }
  return {
    lastName: parts[0],
    firstName: parts[1],
    middleName: parts.slice(2).join(" "),
  };
}

export function regionCodeFromRegistryNumber(registryNumber: string): string | undefined {
  const m = registryNumber.match(/^(\d{2})\//);
  return m?.[1];
}

export function normalizeLawyer(
  row: RegistryValue,
  citySlug: string,
  extras?: { officeAddress?: string; publicPhone?: string }
): ImportLawyerRow | null {
  const fullName = (row.field_1_s ?? "").trim();
  const registryNumber = (row.field_2_s ?? "").trim();
  if (!fullName || !registryNumber) return null;

  const names = parseFullName(fullName);
  const status = mapRegistryStatus(row.field_5_s);
  const identityCardNumber = row.field_4_s?.trim() || undefined;
  const chamberName = row.field_7_s?.trim() || undefined;

  return {
    externalId: row.id,
    registryNumber,
    fullName,
    lastName: names.lastName,
    firstName: names.firstName,
    middleName: names.middleName,
    citySlug,
    registryStatus: status,
    identityCardNumber,
    chamberName,
    regionCode: regionCodeFromRegistryNumber(registryNumber),
    officeAddress: extras?.officeAddress,
    publicPhone: extras?.publicPhone,
  };
}

export function isCatalogStatus(status: RegistryStatus): boolean {
  return status === "ACTIVE" || status === "SUSPENDED";
}
