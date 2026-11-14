/**
 * HTTP client for Minjust EGRA (Единый государственный реестр адвокатов).
 * Base: https://reestrs.minjust.gov.ru
 *
 * Note: reestrs.minjust.gov.ru often fails Node's default TLS trust store on Windows;
 * we use a dedicated HTTPS agent with system-friendly settings for this host only.
 */
import https from "node:https";

export const EGRA_BASE = "https://reestrs.minjust.gov.ru";
export const LAWYERS_REGISTRY_ID = "eee8cb40-0719-e875-a375-6c0059b72bfb";
export const FIRMS_REGISTRY_ID = "be3e58aa-5262-7581-74f2-8d498e39a9af";

export const PAGE_SIZE = 200;
export const DEFAULT_DELAY_MS = 250;
export const MAX_RETRIES = 5;

export type Facets = Record<string, string[]>;

export type RegistryValue = Record<string, unknown> & {
  id: string;
  field_1_s?: string;
  field_2_s?: string;
  field_3_s?: string;
  field_4_s?: string;
  field_5_s?: string;
  field_6_s?: string;
  field_7_s?: string;
  field_8_s?: string;
  lastModified_l?: number;
};

export type ValuesResponse = {
  offset: number;
  limit: number;
  size: number;
  values: RegistryValue[];
};

/** Gov TLS chain is not always in Node's default CA store on Windows. */
const egraAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsJson<T>(
  method: "GET" | "POST",
  url: string,
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf8");
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method,
        agent: egraAgent,
        headers: {
          Accept: "application/json",
          ...(payload
            ? {
                "Content-Type": "application/json;charset=utf-8",
                "Content-Length": String(payload.length),
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(text) as T);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function requestWithRetry<T>(
  method: "GET" | "POST",
  url: string,
  body?: unknown,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await httpsJson<T>(method, url, body);
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < retries) {
        const wait = DEFAULT_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Request failed (${msg}), retry in ${wait}ms`);
        await sleep(wait);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchRegistryPage(options: {
  registryId: string;
  offset: number;
  limit?: number;
  search?: string;
  facets?: Facets;
  sort?: { property: string; direction: string }[];
}): Promise<ValuesResponse> {
  const {
    registryId,
    offset,
    limit = PAGE_SIZE,
    search = "",
    facets = {},
    sort = [],
  } = options;

  return requestWithRetry<ValuesResponse>(
    "POST",
    `${EGRA_BASE}/rest/registry/${registryId}/values`,
    { offset, limit, search, facets, sort }
  );
}

export async function fetchAllRegistryValues(options: {
  registryId: string;
  facets?: Facets;
  search?: string;
  delayMs?: number;
  onPage?: (page: ValuesResponse, fetched: number) => void;
}): Promise<RegistryValue[]> {
  const {
    registryId,
    facets = {},
    search = "",
    delayMs = DEFAULT_DELAY_MS,
    onPage,
  } = options;

  const all: RegistryValue[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const page = await fetchRegistryPage({
      registryId,
      offset,
      limit: PAGE_SIZE,
      facets,
      search,
    });
    total = page.size;
    all.push(...page.values);
    onPage?.(page, all.length);
    offset += PAGE_SIZE;
    if (page.values.length === 0) break;
    if (offset < total) await sleep(delayMs);
  }

  return all;
}

/** Parse field_8_s like "[uuid1,uuid2]" or "[uuid]" into id list. */
export function parseOrgIds(field8?: string): string[] {
  if (!field8) return [];
  const matches = field8.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
  );
  return matches ? [...new Set(matches.map((m) => m.toLowerCase()))] : [];
}

export function addressLooksLikeTolyatti(address?: string): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase().replace(/ё/g, "е");
  return (
    normalized.includes("тольятти") ||
    /\b445\d{3}\b/.test(address) // postal codes of Tolyatti
  );
}
