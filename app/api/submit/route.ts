import { createHash } from "node:crypto";
import { COLUMN_I, CONSENT_VERSION, ENABLE_VIDEO, LIMITS, SHEET_COLUMNS, SHOTS, VIDEO } from "@/lib/config";
import { BackendError, sendToScript, type ScriptFile } from "@/lib/appsScript";
import { allow, clientIp } from "@/lib/rateLimit";
import { formatIST, yearIST, ymdIST } from "@/lib/time";
import { parseNum, parsePayload, type SubmissionPayload } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Upload = { field: string; name: string; mime: string; file: File };

const json = (body: object, status = 200) => Response.json(body, { status });
const log = (evt: string, extra: Record<string, string | number> = {}) =>
  console.info(JSON.stringify({ evt, ...extra })); // never personal data

// Same-instance dedupe: concurrent or repeated requests with one key share one result.
const inflight = new Map<string, Promise<string>>();
const done = new Map<string, { ref: string; at: number }>();
const DONE_TTL_MS = 60 * 60_000;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function referenceFromKey(key: string, now: Date): string {
  const h = createHash("sha256").update(key).digest();
  let s = "";
  for (let i = 0; i < 6; i++) s += CROCKFORD[(h[i] ?? 0) % 32];
  return `ATR-${yearIST(now)}-${s}`;
}

const MAGIC: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
};

async function checkFile(v: FormDataEntryValue | null, allowed: string[], maxBytes: number): Promise<File | string> {
  if (!(v instanceof File)) return "missing";
  if (!allowed.includes(v.type)) return "mime";
  if (v.size === 0 || v.size > maxBytes) return "size";
  const magic = MAGIC[v.type];
  if (magic) {
    const head = new Uint8Array(await v.slice(0, magic.length).arrayBuffer());
    if (!magic.every((b, i) => head[i] === b)) return "mime";
  }
  return v;
}

async function readLimited(req: Request, limit: number): Promise<Uint8Array | null> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function consentTime(iso: string, now: Date): Date {
  const t = Date.parse(iso);
  // Trust the kiosk clock only if it is plausible; otherwise use server time.
  return Number.isFinite(t) && t <= now.getTime() + 5 * 60_000 && t >= now.getTime() - 6 * 3600_000 ? new Date(t) : now;
}

async function processSubmission(p: SubmissionPayload, uploads: Upload[]): Promise<string> {
  const now = new Date();
  const key = p.submissionKey;
  const d = p.details;
  const num = (v: string) => parseNum(v) ?? "";
  const medicine =
    d.onMedicine === "Yes" ? (d.medicineDetails.trim() ? `Yes - ${d.medicineDetails.trim()}` : "Yes") : d.onMedicine;

  // Link cells (photos, signature, folder) and the final Reference ID are filled in by the script.
  const cells: Record<string, string | number> = {
    Timestamp: formatIST(now),
    "Patient Name": d.name.trim(),
    Age: num(d.age),
    Gender: d.gender,
    "Height (cm)": num(d.heightCm),
    "Weight (kgs)": num(d.weightKg),
    "Diabetic Category": d.diabeticCategory,
    HbA1c: num(d.hba1c),
    RBS: num(d.rbs),
    "Currently taking any Medicine?": medicine,
    "Submission ID": key,
    "Consent Version": CONSENT_VERSION,
    "Consent Timestamp": formatIST(consentTime(p.consent.consentedAt, now)),
  };
  if (COLUMN_I) cells[COLUMN_I.header] = num(d.columnI);

  const header: Record<string, string> = { signature: "Signature Link", video: "Face Video" };
  for (const s of SHOTS) header[s.id] = s.column;
  const files: ScriptFile[] = [];
  for (const u of uploads) {
    files.push({ header: header[u.field] ?? u.field, name: u.name, mime: u.mime, data: Buffer.from(await u.file.arrayBuffer()).toString("base64") });
  }

  const res = await sendToScript({
    submissionKey: key,
    referenceId: referenceFromKey(key, now),
    dateStamp: ymdIST(now),
    headers: SHEET_COLUMNS,
    cells,
    files,
  });
  log(res.duplicate ? "submit_duplicate" : "submit_ok", { ref: res.referenceId, files: files.length });
  return res.referenceId;
}

export async function POST(req: Request) {
  const started = Date.now();
  if (!allow(clientIp(req.headers), LIMITS.rateLimitPerMinute)) return json({ error: "rate_limited" }, 429);

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.startsWith("multipart/form-data")) return json({ error: "invalid", field: "content-type" }, 415);
  if (Number(req.headers.get("content-length") ?? 0) > LIMITS.maxRequestBytes) return json({ error: "too_large" }, 413);

  const raw = await readLimited(req, LIMITS.maxRequestBytes);
  if (!raw) return json({ error: "too_large" }, 413);

  let form: FormData;
  try {
    form = await new Response(raw as BodyInit, { headers: { "content-type": ct } }).formData();
  } catch {
    return json({ error: "invalid", field: "body" }, 400);
  }

  // Honeypot: humans never see this field. Pretend success, store nothing.
  const trap = form.get("website");
  if (typeof trap === "string" && trap.trim() !== "") {
    log("honeypot");
    return json({ referenceId: `ATR-${yearIST(new Date())}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` });
  }

  const dataStr = form.get("data");
  if (typeof dataStr !== "string" || dataStr.length > LIMITS.maxDataJsonBytes) return json({ error: "invalid", field: "data" }, 400);
  let data: unknown;
  try {
    data = JSON.parse(dataStr);
  } catch {
    return json({ error: "invalid", field: "data" }, 400);
  }

  const uploads: Upload[] = [];
  for (const s of SHOTS) {
    const f = await checkFile(form.get(s.id), ["image/jpeg"], LIMITS.maxImageBytes);
    if (typeof f === "string") return json({ error: f === "size" ? "too_large" : "invalid", field: s.id }, 400);
    uploads.push({ field: s.id, name: s.fileName, mime: "image/jpeg", file: f });
  }
  const sig = await checkFile(form.get("signature"), ["image/png"], LIMITS.maxSignatureBytes);
  if (typeof sig === "string") return json({ error: "invalid", field: "signature" }, 400);
  uploads.push({ field: "signature", name: "consent_signature.png", mime: "image/png", file: sig });
  if (ENABLE_VIDEO && form.get("video") !== null) {
    const f = await checkFile(form.get("video"), ["video/webm", "video/mp4"], VIDEO.maxBytes + 200_000);
    if (typeof f === "string") return json({ error: "invalid", field: "video" }, 400);
    uploads.push({ field: "video", name: f.type === "video/mp4" ? "face_video.mp4" : "face_video.webm", mime: f.type, file: f });
  }

  const parsed = parsePayload(data, true);
  if (!parsed.ok) return json({ error: "invalid", field: parsed.field }, 400);
  const key = parsed.value.submissionKey;

  const cached = done.get(key);
  if (cached && Date.now() - cached.at < DONE_TTL_MS) return json({ referenceId: cached.ref });

  let job = inflight.get(key);
  if (!job) {
    job = processSubmission(parsed.value, uploads);
    inflight.set(key, job);
  }
  try {
    const ref = await job;
    done.set(key, { ref, at: Date.now() });
    if (done.size > 500) done.delete(done.keys().next().value as string);
    log("submit_done", { ref, ms: Date.now() - started });
    return json({ referenceId: ref });
  } catch (e) {
    if (e instanceof BackendError) {
      log("submit_fail", { code: e.code });
      if (e.code === "busy") return json({ error: "busy" }, 503);
      return json({ error: "server" }, e.code === "server" ? 502 : 500);
    }
    log("submit_fail", { op: "unknown", reason: e instanceof Error ? e.name : "unknown" });
    return json({ error: "server" }, 500);
  } finally {
    inflight.delete(key);
  }
}
