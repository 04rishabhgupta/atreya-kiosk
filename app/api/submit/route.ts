import { COLUMN_I, CONSENT_VERSION, ENABLE_VIDEO, LIMITS, MAX_PHOTO_PARTS, SHEET_COLUMNS, SHOTS, VIDEO } from "@/lib/config";
import { BackendError, sendToScript, type ScriptFile, type ScriptPhoto } from "@/lib/appsScript";
import { allow, clientIp } from "@/lib/rateLimit";
import { subjectId, subjectIdFromKey } from "@/lib/subjectId";
import { formatIST, ymdIST } from "@/lib/time";
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

async function processSubmission(p: SubmissionPayload, uploads: Upload[], photos: ScriptPhoto[]): Promise<string> {
  const now = new Date();
  const key = p.submissionKey;
  const d = p.details;
  const num = (v: string) => parseNum(v) ?? "";
  const medicine =
    d.onMedicine === "Yes" ? (d.medicineDetails.trim() ? `Yes - ${d.medicineDetails.trim()}` : "Yes") : d.onMedicine;

  // Link cells (photos, folder) and the Subject ID are filled in by the script.
  const cells: Record<string, string | number> = {
    Timestamp: formatIST(now),
    Age: num(d.age),
    Gender: d.gender,
    "Diabetic Category": d.diabeticCategory,
    HbA1c: num(d.hba1c),
    RBS: num(d.rbs),
    "Currently taking any Medicine?": medicine,
    "Consent Version": CONSENT_VERSION,
    "Consent Timestamp": formatIST(consentTime(p.consent.consentedAt, now)),
  };
  if (COLUMN_I) cells[COLUMN_I.header] = num(d.columnI);

  const header: Record<string, string> = { video: "Face Video" };
  for (const s of SHOTS) header[s.id] = s.column;
  const files: ScriptFile[] = [];
  for (const u of uploads) {
    files.push({ header: header[u.field] ?? u.field, name: u.name, mime: u.mime, data: Buffer.from(await u.file.arrayBuffer()).toString("base64") });
  }

  const res = await sendToScript({
    submissionKey: key,
    referenceId: subjectIdFromKey(key),
    dateStamp: ymdIST(now),
    headers: SHEET_COLUMNS,
    cells,
    files,
    parts: photos,
  });
  log(res.duplicate ? "submit_duplicate" : "submit_ok", { ref: res.referenceId, files: files.length, photos: photos.length });
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
    return json({ referenceId: subjectId(crypto.getRandomValues(new Uint8Array(10))) });
  }

  const dataStr = form.get("data");
  if (typeof dataStr !== "string" || dataStr.length > LIMITS.maxDataJsonBytes) return json({ error: "invalid", field: "data" }, 400);
  let data: unknown;
  try {
    data = JSON.parse(dataStr);
  } catch {
    return json({ error: "invalid", field: "data" }, 400);
  }

  // Photos: normally already uploaded in pieces via /api/submit/photo, listed in `photos` as piece counts
  // ({"front": 1, ...}). Older kiosk pages still send a small JPEG per shot inside this request instead.
  let manifest: Record<string, unknown> = {};
  const manifestStr = form.get("photos");
  if (typeof manifestStr === "string") {
    try {
      const m: unknown = JSON.parse(manifestStr);
      if (typeof m === "object" && m !== null) manifest = m as Record<string, unknown>;
    } catch {
      return json({ error: "invalid", field: "photos" }, 400);
    }
  }
  const uploads: Upload[] = [];
  const photos: ScriptPhoto[] = [];
  for (const s of SHOTS) {
    const legacy = form.get(s.id);
    if (legacy !== null) {
      const f = await checkFile(legacy, ["image/jpeg"], LIMITS.maxImageBytes);
      if (typeof f === "string") return json({ error: f === "size" ? "too_large" : "invalid", field: s.id }, 400);
      uploads.push({ field: s.id, name: `${s.id}.jpg`, mime: "image/jpeg", file: f });
      continue;
    }
    const count = manifest[s.id];
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_PHOTO_PARTS) {
      return json({ error: "invalid", field: s.id }, 400);
    }
    photos.push({ header: s.column, name: s.fileName, count });
  }
  if (ENABLE_VIDEO && form.get("video") !== null) {
    const f = await checkFile(form.get("video"), ["video/webm", "video/mp4"], VIDEO.maxBytes + 200_000);
    if (typeof f === "string") return json({ error: "invalid", field: "video" }, 400);
    uploads.push({ field: "video", name: f.type === "video/mp4" ? "face_video.mp4" : "face_video.webm", mime: f.type, file: f });
  }

  const parsed = parsePayload(data);
  if (!parsed.ok) return json({ error: "invalid", field: parsed.field }, 400);
  const key = parsed.value.submissionKey;

  const cached = done.get(key);
  if (cached && Date.now() - cached.at < DONE_TTL_MS) return json({ referenceId: cached.ref });

  let job = inflight.get(key);
  if (!job) {
    job = processSubmission(parsed.value, uploads, photos);
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
