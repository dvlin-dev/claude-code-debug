import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export interface ForwardRequestInput {
  upstreamBaseUrl: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export interface ForwardResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  response: http.IncomingMessage;
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
        resolve({
          statusCode: response.statusCode ?? 200,
          headers: response.headers,
          response,
        });
      },
    );

    request.on("error", reject);
    request.end(input.body);
  });
}
