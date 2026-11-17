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
  const classes = await searchShared(college, params.get("q")?.slice(0, 100) ?? "");
  return Response.json({ classes });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Send the class as JSON.", 400);
  }
  const parsed = SharedClassSchema.safeParse(body);
  if (!parsed.success) return error("That class setup is not valid or is too large to share.", 400);
  const stored = await addShared(parsed.data);
  return Response.json({ class: stored }, { status: 201 });
}
