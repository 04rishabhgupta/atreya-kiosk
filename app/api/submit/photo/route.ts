// One piece of one PNG photo. Photos are 1920x1080 PNG (~3.5 MB), too big to send together under Vercel's
// 4.5 MB request limit, so the kiosk sends each one here in pieces of LIMITS.photoPartBytes before the
// final /api/submit, which asks the script to join them. Body: the raw bytes (application/octet-stream).
// Query: key (submissionKey), shot (front|left|right), part (0-based), parts (total pieces for this photo).
import { IMAGE, LIMITS, MAX_PHOTO_PARTS, SHOTS } from "@/lib/config";
import { BackendError, sendToScript } from "@/lib/appsScript";
import { allow, clientIp } from "@/lib/rateLimit";
import { subjectIdFromKey } from "@/lib/subjectId";
import { ymdIST } from "@/lib/time";
import { isUuid } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body: object, status = 200) => Response.json(body, { status });
const log = (evt: string, extra: Record<string, string | number> = {}) =>
  console.info(JSON.stringify({ evt, ...extra })); // never personal data

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** First piece only: a real PNG whose header declares exactly the final photo size. */
function isFullHdPng(b: Uint8Array): boolean {
  if (b.length < 24 || !PNG_SIGNATURE.every((v, i) => b[i] === v)) return false;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const isIhdr = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!) === "IHDR";
  return isIhdr && v.getUint32(16) === IMAGE.width && v.getUint32(20) === IMAGE.height;
}

async function readLimited(req: Request, limit: number): Promise<Uint8Array | null> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
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

export async function POST(req: Request) {
  if (!allow(`${clientIp(req.headers)}|photo`, LIMITS.rateLimitPhotoPartsPerMinute)) return json({ error: "rate_limited" }, 429);

  const q = new URL(req.url).searchParams;
  const key = q.get("key");
  const shot = SHOTS.find((s) => s.id === q.get("shot"));
  const part = Number(q.get("part"));
  const parts = Number(q.get("parts"));
  if (!isUuid(key)) return json({ error: "invalid", field: "key" }, 400);
  if (!shot) return json({ error: "invalid", field: "shot" }, 400);
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PHOTO_PARTS || !Number.isInteger(part) || part < 0 || part >= parts) {
    return json({ error: "invalid", field: "part" }, 400);
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.startsWith("application/octet-stream")) return json({ error: "invalid", field: "content-type" }, 415);
  if (Number(req.headers.get("content-length") ?? 0) > LIMITS.photoPartBytes) return json({ error: "too_large" }, 413);
  const bytes = await readLimited(req, LIMITS.photoPartBytes);
  if (!bytes) return json({ error: "too_large" }, 413);
  // Every piece but the last is exactly one piece long, so the joined file is the original byte for byte.
  const last = part === parts - 1;
  if (bytes.length === 0 || (!last && bytes.length !== LIMITS.photoPartBytes)) return json({ error: "invalid", field: shot.id }, 400);
  if (part === 0 && !isFullHdPng(bytes)) return json({ error: "invalid", field: shot.id }, 400);

  const now = new Date();
  try {
    await sendToScript({
      action: "part",
      submissionKey: key,
      referenceId: subjectIdFromKey(key),
      dateStamp: ymdIST(now),
      name: shot.fileName,
      index: part,
      data: Buffer.from(bytes).toString("base64"),
    });
    log("photo_part_ok", { shot: shot.id, part, parts, bytes: bytes.length });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof BackendError) {
      log("photo_part_fail", { code: e.code });
      if (e.code === "busy") return json({ error: "busy" }, 503);
      return json({ error: "server" }, e.code === "server" ? 502 : 500);
    }
    log("photo_part_fail", { op: "unknown", reason: e instanceof Error ? e.name : "unknown" });
    return json({ error: "server" }, 500);
  }
}
