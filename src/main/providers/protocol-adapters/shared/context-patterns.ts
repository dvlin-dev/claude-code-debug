/**
 * Shared regex patterns for detecting injected context in agent messages.
 * Used by both derive-title.ts (noise skipping) and annotate-blocks.ts (classification).
 */

/** Inline noise patterns — lines that are hook/system output, not user content. */
export const NOISE_PATTERNS = [
  /^SessionStart:/i,
  /^hook\s+(?:success|error|failure|output|result)/i,
  /^startup\s+hook\s/i,
  /^\[.*hook.*\]/i,
  /^<command-name>/i,
  /^<local-command/i,
  /^\[SUGGESTION MODE[:\]]/i,
  /^#\s+AGENTS\.md\b/i,
  /^Caveat:\s*The messages below/i,
];

/** Wrapper patterns — entire blocks wrapped in XML tags that are injected context. */
export const NOISE_WRAPPER_PATTERNS = [
  /^<system-reminder>/i,
  /^<user-prompt-submit-hook>/i,
  /^<local-command-caveat>/i,
  /^<command-name>/i,
  /^<local-command-stdout>/i,
  /^<environment_context>/i,
  /^<collaboration_mode>/i,
  /^<permissions\s+instructions>/i,
  /^<INSTRUCTIONS>/,
  /^\[SUGGESTION MODE[:\]]/i,
  /^#\s+AGENTS\.md\b/i,
];

/** Matches a `<system-reminder>` wrapper block. */
export const SYSTEM_REMINDER_RE = /^<system-reminder>/i;

/** Matches a `<user-prompt-submit-hook>` wrapper block. */
export const HOOK_OUTPUT_RE = /^<user-prompt-submit-hook>/i;

/** Matches local command context (caveat, name, stdout). */
export const COMMAND_CONTEXT_RE = /^<(?:local-command-caveat|command-name|local-command-stdout)>/i;

/** Matches Codex/agent environment wrappers and injected instruction blocks. */
export const AGENT_CONTEXT_RE =
  /^(?:<(?:environment_context|collaboration_mode|permissions\s+instructions|INSTRUCTIONS)>|#\s+AGENTS\.md\s*\n)/i;

/** Matches suggestion mode prompt injection. */
export const SUGGESTION_MODE_RE = /^\[SUGGESTION MODE[:\]]/i;

/** Inline patterns for hook-related output (not wrapped in XML). */
export const HOOK_INLINE_RES = [
  /^SessionStart:/i,
  /^hook\s+(?:success|error|failure|output|result)/i,
  /^startup\s+hook\s/i,
  /^<command-name>/i,
  /^<local-command/i,
];

/** Detects skills list content inside a system-reminder. */
export const SKILLS_LIST_RE = /skills?\s+(?:are\s+)?available|following\s+skills/i;

/** Detects CLAUDE.md / project instructions content inside a system-reminder. */
export const CLAUDE_MD_RE = /Contents\s+of\s+.*CLAUDE\.md|project\s+instructions/i;
