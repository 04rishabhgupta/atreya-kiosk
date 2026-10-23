const IST = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(d: Date) {
  const p: Record<string, string> = {};
  for (const { type, value } of IST.formatToParts(d)) p[type] = value;
  return p;
}

/** DD/MM/YYYY HH:mm:ss in Asia/Kolkata. */
export function formatIST(d: Date): string {
  const p = parts(d);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

/** YYYYMMDD in Asia/Kolkata. */
export function ymdIST(d: Date): string {
  const p = parts(d);
  return `${p.year}${p.month}${p.day}`;
}

export function yearIST(d: Date): string {
  return parts(d).year ?? String(d.getUTCFullYear());
}
