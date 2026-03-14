import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { forwardRequest } from "../../../src/main/transport/forwarder";

function createServer(
  handler: http.RequestListener,
): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve test server port"));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error);
              else closeResolve();
            });
          }),
      });
    });
  });
}

function collectBody(response: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => resolve(Buffer.concat(chunks)));
    response.on("error", reject);
  });
}

const cleaners: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleaners.length > 0) {
    const close = cleaners.pop();
    if (close) await close();
  }
});

describe("forwarder", () => {
  it("forwards request to the profile upstream while preserving path and query", async () => {
    const server = await createServer((req, res) => {
      expect(req.url).toBe("/api/v1/messages?stream=true");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    cleaners.push(server.close);

    const result = await forwardRequest({
      upstreamBaseUrl: `http://127.0.0.1:${server.port}/api`,
      method: "POST",
      path: "/v1/messages?stream=true",
      headers: { "content-type": "application/json" },
      body: Buffer.from("{}"),
    });

    expect(result.statusCode).toBe(200);
    const body = await collectBody(result.response);
    expect(body.toString("utf-8")).toBe('{"ok":true}');
  });

  it("exposes the upstream response as a stream for chunk-by-chunk reading", async () => {
    const server = await createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.write("chunk-1");
      setTimeout(() => {
        res.end("chunk-2");
      }, 50);
    });
    cleaners.push(server.close);

    const result = await forwardRequest({
      upstreamBaseUrl: `http://127.0.0.1:${server.port}`,
      method: "GET",
      path: "/stream",
      headers: {},
      body: Buffer.alloc(0),
    });

    // Collect chunks manually to verify streaming
    const chunks: string[] = [];
    result.response.on("data", (chunk: Buffer) => {
      chunks.push(chunk.toString("utf-8"));
    });

    await new Promise<void>((resolve) => {
      result.response.on("end", resolve);
    });

    expect(chunks.join("")).toBe("chunk-1chunk-2");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
