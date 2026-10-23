import { isConfigured } from "@/lib/appsScript";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, configured: isConfigured() });
}
