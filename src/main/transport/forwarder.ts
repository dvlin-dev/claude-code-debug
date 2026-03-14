import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export interface ForwardRequestInput {
  upstreamBaseUrl: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ForwardResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  response: http.IncomingMessage;
  bodyBuffer: Promise<Buffer>;
}

function joinTargetPath(target: URL, requestPath: string): string {
  const [rawPathname, search = ""] = requestPath.split("?");
  const normalizedBase = target.pathname.replace(/\/+$/, "");
  const normalizedRequestPath = rawPathname.startsWith("/")
    ? rawPathname
    : `/${rawPathname}`;
  const pathname = normalizedBase
    ? `${normalizedBase}${normalizedRequestPath}`
    : normalizedRequestPath;

  return search ? `${pathname}?${search}` : pathname;
}

export function forwardRequest(
  input: ForwardRequestInput,
): Promise<ForwardResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(input.upstreamBaseUrl);
    const isHttps = target.protocol === "https:";
    const transport = isHttps ? https : http;

    const request = transport.request(
      {
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: joinTargetPath(target, input.path),
        method: input.method,
        headers: {
          ...input.headers,
          host: target.host,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        const bodyBuffer = new Promise<Buffer>((bodyResolve, bodyReject) => {
          response.on("data", (chunk: Buffer) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            bodyResolve(Buffer.concat(chunks));
          });
          response.on("error", bodyReject);
          // Use "close" + complete check instead of deprecated "aborted" event.
          // The "aborted" event (deprecated since Node v17) can fire spuriously
          // at the end of a normal response stream, causing false rejections.
          response.on("close", () => {
            if (!response.complete) {
              bodyReject(new Error("Upstream response closed before completion"));
            }
          });
        });

        resolve({
          statusCode: response.statusCode ?? 200,
          headers: response.headers,
          response,
          bodyBuffer,
        });
      },
    );

    const abortRequest = () => {
      request.destroy(new Error("Upstream request aborted"));
    };
    if (input.signal) {
      if (input.signal.aborted) {
        abortRequest();
        return;
      }
      input.signal.addEventListener("abort", abortRequest, { once: true });
      request.once("close", () => {
        input.signal?.removeEventListener("abort", abortRequest);
      });
    }

    request.setTimeout(input.timeoutMs ?? 120_000, () => {
      request.destroy(new Error("Upstream request timed out"));
    });
    request.on("error", reject);
    if (input.body.length > 0) {
      request.write(input.body);
    }
    request.end();
  });
}
