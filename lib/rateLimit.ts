// Per-instance sliding-window limiter. Cheap abuse guard, not a security boundary:
// each serverless instance keeps its own window.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_KEYS = 5_000;

export function allow(ip: string, limit: number, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.delete(ip); // re-insert to keep Map order = least recently used first
  hits.set(ip, recent);
  if (hits.size > MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  return true;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
