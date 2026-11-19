import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ImportedCourseSchema } from "@/lib/import-schema";

/**
 * Reads a syllabus or gradebook (PDF or screenshot) and returns the class's
 * grading setup as JSON. The file is sent to the Claude API for this one
 * request and is not stored by this app.
 *
 * Needs ANTHROPIC_API_KEY in the server environment (.env.local in development).
 */

export const maxDuration = 120;

// Vercel rejects request bodies over 4.5 MB, so stay under that.
const MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const INSTRUCTIONS = `This file is a student's course syllabus or a gradebook page (for example from Canvas or Blackboard). Extract the grading setup so a grade calculator can use it.

- Capture every grading category with its weight and any "drop the lowest N" rule.
- List individual assignments when the document names them or shows how many there are (e.g. "10 weekly quizzes" becomes Quiz 1 to Quiz 10). Include assignments that are not graded yet with earned set to null, since the student needs them to see what is left in the course.
- Record scores only when the document shows them. Never guess a score.
- Record letter-grade cutoffs only if the document states them.
- Put anything that does not fit this structure, or that you had to assume, in notes.
- If the file is not a syllabus or gradebook, return no categories and say so in notes.`;

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return error("Send the file as form data.", 400);
  }
  if (!file) return error("No file was uploaded.", 400);
  if (file.size > MAX_BYTES) return error("That file is over 4 MB. Try a smaller file or a screenshot.", 413);

  const isPdf = file.type === "application/pdf";
  const isImage = (IMAGE_TYPES as readonly string[]).includes(file.type);
  if (!isPdf && !isImage) return error("Upload a PDF or an image (PNG, JPEG, WebP, GIF).", 415);

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    return error("AI import is not set up on this server yet (no API key).", 503);
  }

  try {
    const message = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // If the model declines the request, the API retries it on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { format: betaZodOutputFormat(ImportedCourseSchema) },
      messages: [
        {
          role: "user",
          content: [
            isPdf
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
              : { type: "image", source: { type: "base64", media_type: file.type as ImageType, data } },
            { type: "text", text: INSTRUCTIONS },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") return error("The AI could not process that file.", 422);
    if (message.stop_reason === "max_tokens") {
      return error("That file has too much in it to import in one go. Try uploading fewer pages.", 422);
    }
    if (!message.parsed_output) return error("The AI could not read a grading setup from that file.", 422);
    return Response.json({ course: message.parsed_output });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return error("AI import is not set up on this server yet (API key missing or invalid).", 503);
    }
    if (e instanceof Anthropic.RateLimitError) return error("AI import is busy right now. Try again in a minute.", 429);
    if (e instanceof Anthropic.BadRequestError) return error("The AI could not read that file. Try a different file.", 400);
    if (e instanceof Anthropic.APIConnectionError) return error("Could not reach the AI service. Try again.", 502);
    if (e instanceof Anthropic.APIError) return error("The AI service had a problem. Try again.", 502);
    // The SDK throws a plain error before sending anything when it finds no credentials.
    if (e instanceof Error && /authentication method/i.test(e.message)) {
      return error("AI import is not set up on this server yet (no API key).", 503);
    }
    throw e;
  }
}
