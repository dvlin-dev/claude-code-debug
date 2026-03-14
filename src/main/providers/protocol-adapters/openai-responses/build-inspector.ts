import type {
  CapturedExchange,
  InspectorDocument,
  NormalizedExchange,
} from "../../../../shared/contracts";
import { buildInspectorDocument } from "../shared/build-inspector-sections";

export function buildOpenAiResponsesInspector(
  exchange: CapturedExchange,
  normalized: NormalizedExchange,
): InspectorDocument {
  const extraSections = normalized.request.meta.reasoning
    ? [{ kind: "json" as const, title: "Reasoning", json: normalized.request.meta.reasoning }]
    : [];

  return buildInspectorDocument(exchange, normalized, extraSections);
}
