import type { ProviderId } from "./provider";

export interface ConnectionProfile {
  id: string;
  name: string;
  providerId: ProviderId;
  upstreamBaseUrl: string;
  localPort: number;
  enabled: boolean;
  autoStart: boolean;
}
