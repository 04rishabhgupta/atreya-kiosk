// Subject ID shared by the submit and photo routes: the photo pieces and the final row must land in the
// same Drive folder, so both derive the ID from the kiosk's submissionKey the same way.
import { createHash } from "node:crypto";

// Subject ID: ATR-XXXXX-XXXXX, derived from the kiosk's submissionKey so every retry gets the same ID.
// It is also what the script dedupes on, so it must not repeat: 10 characters (50 bits) keep the chance
// of two participants sharing one below 1 in 200,000 even after 100,000 submissions.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const subjectId = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < 10; i++) s += CROCKFORD[(bytes[i] ?? 0) % 32];
  return `ATR-${s.slice(0, 5)}-${s.slice(5)}`;
};
export const subjectIdFromKey = (key: string) => subjectId(createHash("sha256").update(key).digest());
