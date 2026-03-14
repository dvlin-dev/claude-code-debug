import type { NormalizedExchange } from "../../../../shared/contracts";
import { stripXmlTags } from "../../../../shared/strip-xml";

/**
 * Patterns that indicate a non-substantive message (hooks, system output, etc.).
 * These are skipped when searching for a meaningful title.
 */
const NOISE_PATTERNS = [
  /^SessionStart:/i,
  /^hook\s/i,
  /^startup\s/i,
  /^\[.*hook.*\]/i,
  /^<command-name>/i,
  /^<local-command/i,
];

const MIN_TITLE_LENGTH = 5;
const MAX_TITLE_LENGTH = 60;

function isNoise(text: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

function cleanText(raw: string): string {
  return stripXmlTags(raw)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Derive a human-readable session title from the first substantive user message.
 * Strips XML tags, skips hook/system output, and skips very short messages.
 */
export function deriveTitleFromExchange(
  normalized: NormalizedExchange,
  fallbackLabel: string,
): string {
  for (const message of normalized.request.inputMessages) {
    if (message.role !== "user") continue;

    const raw = message.blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(" ");

    const text = cleanText(raw);

    if (!text || text.length < MIN_TITLE_LENGTH || isNoise(text)) {
      continue;
    }

    return text.length > MAX_TITLE_LENGTH
      ? `${text.slice(0, MAX_TITLE_LENGTH)}…`
      : text;
  }

  return normalized.model ?? fallbackLabel;
}
