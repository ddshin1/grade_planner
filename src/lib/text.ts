/** Lower-case words for matching, with "cs225" split into "cs" and "225". */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True when every query word starts some word of the text. */
export function matchesAll(queryWords: string[], textWords: string[]): boolean {
  return queryWords.every((q) => textWords.some((t) => t.startsWith(q)));
}

export const slug = (text: string) => words(text).join("-");
