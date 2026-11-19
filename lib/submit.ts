// XHR instead of fetch: we need upload progress for the progress bar on slow Wi-Fi.
import { LIMITS } from "./config";

export type SubmitResult = { ok: true; referenceId: string } | { ok: false; error: string; status: number };

type Reply = { status: number; body: { referenceId?: string; error?: string; ok?: boolean } };

function send(url: string, body: Blob | FormData, onProgress: (loaded: number) => void): Promise<Reply> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 120_000;
    if (body instanceof Blob) xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      let parsed: Reply["body"] = {};
      try {
        parsed = JSON.parse(xhr.responseText) as Reply["body"];
      } catch {
        /* non-JSON (proxy error page) */
      }
      resolve({ status: xhr.status, body: parsed });
    };
    xhr.onerror = () => resolve({ status: 0, body: { error: "network" } });
    xhr.ontimeout = () => resolve({ status: 0, body: { error: "network" } });
    xhr.send(body);
  });
}

const failure = (r: Reply): SubmitResult => ({
  ok: false,
  error: r.body.error ?? (r.status === 413 ? "too_large" : r.status === 0 ? "network" : "server"),
  status: r.status,
});

/**
 * Uploads each photo to /api/submit/photo in pieces of LIMITS.photoPartBytes (each request stays under
 * Vercel's 4.5 MB limit), then sends `form` (details, consent and a `photos` piece count per shot) to
 * /api/submit, which joins the pieces and writes the row. Every step is safe to repeat with the same key.
 */
export async function submitWithPhotos(
  key: string,
  photos: { id: string; blob: Blob }[],
  form: FormData,
  onProgress: (p: number) => void,
): Promise<SubmitResult> {
  const total = photos.reduce((n, p) => n + p.blob.size, 0) || 1;
  let sent = 0;
  const counts: Record<string, number> = {};
  for (const { id, blob } of photos) {
    const parts = Math.max(1, Math.ceil(blob.size / LIMITS.photoPartBytes));
    counts[id] = parts;
    for (let part = 0; part < parts; part++) {
      const piece = blob.slice(part * LIMITS.photoPartBytes, (part + 1) * LIMITS.photoPartBytes);
      const q = new URLSearchParams({ key, shot: id, part: String(part), parts: String(parts) });
      const r = await send(`/api/submit/photo?${q}`, piece, (loaded) => onProgress((sent + loaded) / total));
      if (r.status !== 200 || !r.body.ok) return failure(r);
      sent += piece.size;
      onProgress(sent / total);
    }
  }
  form.append("photos", JSON.stringify(counts));
  onProgress(1); // photos are up; the bar switches to "Saving securely…" while the row is written
  const r = await send("/api/submit", form, () => undefined);
  if (r.status === 200 && r.body.referenceId) return { ok: true, referenceId: r.body.referenceId };
  return failure(r);
}
