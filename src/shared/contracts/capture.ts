import type { ProviderId } from "./provider";

export interface CapturedBody {
  bytes: Uint8Array;
  contentType: string | null;
  contentEncoding: string | null;
}

export interface CapturedExchange {
  exchangeId: string;
  providerId: ProviderId;
  profileId: string;
  method: string;
  path: string;
  requestHeaders: Record<string, string>;
  requestBody: CapturedBody | null;
  responseHeaders: Record<string, string> | null;
  responseBody: CapturedBody | null;
  statusCode: number | null;
  startedAt: string;
  durationMs: number | null;
  requestSize: number;
  responseSize: number | null;
}
