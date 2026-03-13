export interface AppSettings {
  targetUrl: string;
}

export interface SessionSummary {
  sessionId: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  requestCount: number;
  model: string | null;
}

export interface RequestRecord {
  requestId: string;
  sessionId: string;
  method: string;
  path: string;
  timestamp: string;
  duration: number | null;
  model: string | null;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  statusCode: number | null;
  requestSize: number;
  responseSize: number | null;
}

export interface CaptureUpdatePayload {
  sessions: SessionSummary[];
  updatedSessionId: string | null;
  updatedRequestId: string | null;
}
