import { allow, visitor } from "@/lib/server/rate-limit";
import { reportShared } from "@/lib/server/class-store";

/** POST /api/classes/<id>/report: flag a shared setup as wrong. Enough reports hide it from search. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Unknown class." }, { status: 404 });
  // One report per visitor per setup per day, and a cap overall.
  const who = visitor(request);
  if (!allow(`report:${who}:${id}`, 1, 24 * 60 * 60 * 1000) || !allow(`reports:${who}`, 30, 60 * 60 * 1000)) {
    return Response.json({ ok: true });
  }
  try {
    await reportShared(id);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not send the report right now." }, { status: 503 });
  }
}
