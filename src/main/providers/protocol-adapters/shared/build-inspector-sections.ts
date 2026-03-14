import type {
  CapturedExchange,
  InspectorDocument,
  InspectorSection,
  NormalizedExchange,
} from "../../../../shared/contracts";
import { getCapturedBodyText } from "../../../capture/body-codec";
import { formatProviderLabel } from "../../format-provider-label";

/**
 * Builds the common inspector sections shared by all protocol adapters:
 * overview, instructions, tools, then any extra sections, then raw request/response.
 */
export function buildInspectorDocument(
  exchange: CapturedExchange,
  normalized: NormalizedExchange,
  extraSections: InspectorSection[] = [],
): InspectorDocument {
  const sections: InspectorSection[] = [
    {
      kind: "overview",
      title: "Overview",
      items: [
        { label: "Provider", value: formatProviderLabel(exchange.providerId) },
        { label: "Profile", value: exchange.profileId },
        { label: "Path", value: exchange.path },
        { label: "Model", value: normalized.model ?? "unknown" },
        { label: "Status", value: String(exchange.statusCode ?? "unknown") },
        ...(normalized.response.stopReason != null
          ? [{ label: "Stop Reason", value: normalized.response.stopReason }]
          : []),
        ...(normalized.response.usage?.inputTokens != null
          ? [{ label: "Input Tokens", value: String(normalized.response.usage.inputTokens) }]
          : []),
        ...(normalized.response.usage?.outputTokens != null
          ? [{ label: "Output Tokens", value: String(normalized.response.usage.outputTokens) }]
          : []),
        ...(normalized.response.usage?.reasoningTokens != null
          ? [{ label: "Reasoning Tokens", value: String(normalized.response.usage.reasoningTokens) }]
          : []),
      ],
    },
  ];

  const instructionText = normalized.request.instructions
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  if (instructionText.length > 0) {
    sections.push({
      kind: "text",
      title: "Instructions",
      text: instructionText,
    });
  }

  if (normalized.request.tools.length > 0) {
    sections.push({
      kind: "tool-list",
      title: "Tools",
      tools: normalized.request.tools,
    });
  }

  sections.push(...extraSections);

  sections.push({
    kind: "raw-request",
    title: "Raw Request",
    content: getCapturedBodyText(exchange.requestBody),
  });
  sections.push({
    kind: "raw-response",
    title: "Raw Response",
    content: getCapturedBodyText(exchange.responseBody),
  });

  return { sections };
}
