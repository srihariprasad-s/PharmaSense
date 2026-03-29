import { logger } from "./logger";

const PROXY_URL = "https://nmc-verify-proxy-production.up.railway.app";

// Two profiles:
//  • QUICK  – live lookup while the doctor is typing on the form
//  • THOROUGH – final verification during registration / re-verify
const QUICK = { maxRetries: 4, timeoutMs: 30_000, retryDelayMs: 800 };
const THOROUGH = { maxRetries: 6, timeoutMs: 45_000, retryDelayMs: 1_000 };

export interface NMCRecord {
  year: number;
  registrationNumber: string;
  stateCouncil: string;
  name: string;
  fatherName: string;
}

export type NMCFetchResult =
  | { status: "found"; raw: { recordsFiltered: number; data: any[][] } }
  | { status: "not_found" }
  | { status: "unreachable" };

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNMCDataOnce(
  registrationNumber: string,
  timeoutMs: number,
): Promise<NMCFetchResult> {
  const url = `${PROXY_URL}/api/nmc-verify?regNo=${encodeURIComponent(registrationNumber)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

  if (!response.ok) {
    logger.info({ status: response.status }, "NMC proxy returned non-200");
    return { status: "unreachable" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json();

  // Proxy itself failed to reach NMC server
  if (json?.error) {
    logger.info({ error: json.error }, "NMC proxy reported upstream error");
    return { status: "unreachable" };
  }

  if (!json?.data || !Array.isArray(json.data) || json.recordsFiltered === 0) {
    return { status: "not_found" };
  }

  return { status: "found", raw: json as { recordsFiltered: number; data: any[][] } };
}

async function fetchNMCData(
  registrationNumber: string,
  cfg: { maxRetries: number; timeoutMs: number; retryDelayMs: number },
): Promise<NMCFetchResult> {
  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    try {
      logger.info({ attempt, registrationNumber, maxRetries: cfg.maxRetries }, "NMC fetch attempt");
      const result = await fetchNMCDataOnce(registrationNumber, cfg.timeoutMs);
      if (result.status !== "unreachable") return result;

      if (attempt < cfg.maxRetries) {
        logger.info({ attempt, registrationNumber }, "NMC unreachable — retrying");
        await sleep(cfg.retryDelayMs);
      }
    } catch {
      logger.info({ attempt }, "NMC fetch timed out, retrying");
      if (attempt < cfg.maxRetries) await sleep(cfg.retryDelayMs);
    }
  }

  logger.info({ registrationNumber }, "NMC server did not respond — will proceed with pending status");
  return { status: "unreachable" };
}

function parseRow(row: any[], fallbackRegNo: string): NMCRecord {
  return {
    year: parseInt(row[1]?.toString() || "0"),
    registrationNumber: row[2]?.toString() || fallbackRegNo,
    stateCouncil: row[3]?.toString() || "",
    name: row[4]?.toString() || "",
    fatherName: row[5]?.toString() || "",
  };
}

/** Quick lookup — used for the live form widget while typing (4 retries × 12 s). */
export async function lookupNMC(
  registrationNumber: string,
): Promise<{ record: NMCRecord | null; unreachable: boolean }> {
  const result = await fetchNMCData(registrationNumber, QUICK);

  if (result.status === "unreachable") return { record: null, unreachable: true };
  if (result.status === "not_found") return { record: null, unreachable: false };

  return { unreachable: false, record: parseRow(result.raw.data[0], registrationNumber) };
}

/** Thorough verification — used during registration / re-verify (6 retries × 15 s). */
export async function verifyWithNMC(
  registrationNumber: string,
  year: string,
  stateCouncil: string,
  fatherName: string,
): Promise<{ verified: boolean; unreachable: boolean; record?: NMCRecord }> {
  try {
    const result = await fetchNMCData(registrationNumber, THOROUGH);

    if (result.status === "unreachable") return { verified: false, unreachable: true };
    if (result.status === "not_found") return { verified: false, unreachable: false };

    const record = parseRow(result.raw.data[0], registrationNumber);

    const yearMatch = record.year.toString() === year.toString();
    const stateCouncilMatch =
      record.stateCouncil.toLowerCase().includes(stateCouncil.toLowerCase()) ||
      stateCouncil.toLowerCase().includes(record.stateCouncil.toLowerCase());
    const fatherNameMatch =
      record.fatherName.toLowerCase().includes(fatherName.toLowerCase().trim()) ||
      fatherName.toLowerCase().includes(record.fatherName.toLowerCase().trim());

    const verified = yearMatch && stateCouncilMatch && fatherNameMatch;
    return { verified, unreachable: false, record };
  } catch (err) {
    logger.error({ err }, "NMC verification failed");
    return { verified: false, unreachable: true };
  }
}
