import http from "node:http";
import net from "node:net";
import type { Duplex } from "node:stream";
import type { ConnectionProfile } from "../../shared/contracts";

export interface ListenerDependencies {
  onRequest: (
    profile: ConnectionProfile,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => void | Promise<void>;
  onUpgrade?: (
    profile: ConnectionProfile,
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void | Promise<void>;
  onError?: (profile: ConnectionProfile, error: Error) => void;
}

export interface ProfileListener {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  getPort(): number;
}

export function createProfileListener(
  profile: ConnectionProfile,
  deps: ListenerDependencies,
): ProfileListener {
  let server: http.Server | null = null;
  let running = false;
  const sockets = new Set<net.Socket>();

  return {
    async start() {
      if (running) return;

      server = http.createServer((req, res) => {
        Promise.resolve(deps.onRequest(profile, req, res)).catch((error) => {
          deps.onError?.(
            profile,
            error instanceof Error ? error : new Error(String(error)),
          );
        });
      });
      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.on("close", () => {
          sockets.delete(socket);
        });
      });
      server.on("upgrade", (req, socket, head) => {
        if (!deps.onUpgrade) {
          socket.write(
            "HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\nContent-Length: 0\r\n\r\n",
          );
          socket.destroy();
          return;
        }

        Promise.resolve(deps.onUpgrade(profile, req, socket, head)).catch((error) => {
          deps.onError?.(
            profile,
            error instanceof Error ? error : new Error(String(error)),
          );
          socket.destroy();
        });
      });

      await new Promise<void>((resolve, reject) => {
        server?.once("error", reject);
        server?.listen(profile.localPort, "127.0.0.1", () => {
          running = true;
          resolve();
        });
      });
    },

    async stop() {
      if (!server || !running) return;
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 5_000);
        server?.close((error) => {
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve();
        });
      });
      running = false;
      server = null;
      sockets.clear();
    },

    isRunning() {
      return running;
    },

    getPort() {
      return profile.localPort;
    },
  };
}
