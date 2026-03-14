import type {
  CapturedExchange,
  InspectorDocument,
  NormalizedExchange,
} from "../../../../shared/contracts";
import { buildInspectorDocument } from "../shared/build-inspector-sections";

export function buildAnthropicInspector(
  exchange: CapturedExchange,
  normalized: NormalizedExchange,
): InspectorDocument {
  return buildInspectorDocument(exchange, normalized);
}
