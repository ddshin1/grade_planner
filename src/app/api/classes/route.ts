import { allow, visitor } from "@/lib/server/rate-limit";
import { addShared, searchShared } from "@/lib/server/class-store";
import { SharedClassSchema } from "@/lib/shared";

/**
 * The shared class library.
 *   GET  /api/classes?college=<key>&q=<search>  setups other students shared at that college
 *   POST /api/classes                           share a setup (no scores, see SharedClassSchema)
 */

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const college = params.get("college")?.slice(0, 120);
  if (!college) return error("Pick a college first.", 400);
  try {
    const classes = await searchShared(college, params.get("q")?.slice(0, 100) ?? "");
    return Response.json({ classes });
  } catch (e) {
    console.error(e);
    return error("Could not search shared classes right now.", 503);
  }
}

export async function POST(request: Request) {
  if (!allow(`share:${visitor(request)}`, 20, 60 * 60 * 1000)) {
    return error("You have shared a lot of classes in the last hour. Try again later.", 429);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Send the class as JSON.", 400);
  }
  const parsed = SharedClassSchema.safeParse(body);
  if (!parsed.success) return error("That class setup is not valid or is too large to share.", 400);
  try {
    const stored = await addShared(parsed.data);
    return Response.json({ class: stored }, { status: 201 });
  } catch (e) {
    console.error(e);
    return error("Could not share right now. Try again in a moment.", 503);
  }
}
