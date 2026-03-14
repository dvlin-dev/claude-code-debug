import type { NormalizedTool } from "./normalized";

export interface InspectorDocument {
  sections: InspectorSection[];
}

export type InspectorSection =
  | {
      kind: "overview";
      title: string;
      items: Array<{ label: string; value: string }>;
    }
  | {
      kind: "text";
      title: string;
      text: string;
    }
  | {
      kind: "tool-list";
      title: string;
      tools: NormalizedTool[];
    }
  | {
      kind: "json";
      title: string;
      json: unknown;
    }
  | {
      kind: "raw-request";
      title: string;
      content: string | null;
    }
  | {
      kind: "raw-response";
      title: string;
      content: string | null;
    };
