// Server-only. Sends a validated submission to the Apps Script web app (apps-script/Code.gs),
// which writes the Drive files and the Sheet row. The URL and secret never reach the browser.

export type BackendCode = "config" | "auth" | "busy" | "server" | "invalid";

export class BackendError extends Error {
  readonly code: BackendCode;
  constructor(code: BackendCode, detail = "") {
    super(`apps_script_${code}${detail ? `: ${detail}` : ""}`);
    this.code = code;
  }
}

export interface ScriptFile {
  header: string; // sheet column that receives this file's link
  name: string;
  mime: string;
  data: string; // base64
}

export interface ScriptRequest {
  submissionKey: string;
  referenceId: string;
  dateStamp: string; // YYYYMMDD (IST) for the folder name
  headers: string[];
  cells: Record<string, string | number>;
  files: ScriptFile[];
}

export const isConfigured = () => !!process.env.APPS_SCRIPT_URL && !!process.env.APPS_SCRIPT_SECRET;

/** Neutralise spreadsheet formula injection (the script also appends with RAW). */
export function safeCell(v: string | number): string | number {
  if (typeof v === "number") return v;
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST with retry + backoff. Safe to retry: the script dedupes on submissionKey under a lock,
 * so a retry after a timeout returns the already-saved Subject ID instead of a second row.
 */
export async function sendToScript(req: ScriptRequest, budgetMs = 50_000): Promise<{ referenceId: string; duplicate: boolean }> {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new BackendError("config", "missing env");
  if (!url.startsWith("https://script.google.com/")) throw new BackendError("config", "bad url");

  const body = JSON.stringify({ ...req, cells: Object.fromEntries(Object.entries(req.cells).map(([k, v]) => [k, safeCell(v)])), secret });
  const deadline = Date.now() + budgetMs;
  let last = new BackendError("busy", "no attempt");

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(Math.min(800 * 2 ** (attempt - 1) + Math.random() * 400, Math.max(0, deadline - Date.now() - 5000)));
    const left = deadline - Date.now();
    if (left < 5000) break;
    try {
      // Apps Script answers a POST with a 302 to googleusercontent.com; fetch follows it as a GET.
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        redirect: "follow",
        signal: AbortSignal.timeout(left),
      });
      const text = await res.text();
      let j: { ok?: boolean; referenceId?: string; duplicate?: boolean; error?: string };
      try {
        j = JSON.parse(text) as typeof j;
      } catch {
        // HTML instead of JSON: quota page, Google outage, or a wrong deployment URL.
        last = new BackendError(res.status === 404 ? "config" : "busy", `http_${res.status}`);
        if (res.status === 404) throw last;
        continue;
      }
      if (j.ok && j.referenceId) return { referenceId: j.referenceId, duplicate: !!j.duplicate };
      if (j.error === "unauthorized") throw new BackendError("auth", "secret mismatch");
      if (j.error === "invalid") throw new BackendError("invalid");
      last = new BackendError(j.error === "busy" ? "busy" : "server", j.error);
    } catch (e) {
      if (e instanceof BackendError && (e.code === "auth" || e.code === "config" || e.code === "invalid")) throw e;
      if (!(e instanceof BackendError)) last = new BackendError("busy", e instanceof Error ? e.name : "network");
    }
  }
  throw last;
}
