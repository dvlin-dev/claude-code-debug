import type {
  CapturedExchange,
  ProtocolAdapter,
} from "../../shared/contracts";
import { SessionResolver } from "./session-resolver";
import { ExchangeRepository } from "../storage/exchange-repository";
import { SessionRepository } from "../storage/session-repository";
import type { HistoryMaintenanceService } from "../storage/history-maintenance-service";
import type { ProviderCatalog } from "../providers/provider-catalog";

export interface CapturePipelineDependencies {
  providerCatalog: ProviderCatalog;
  protocolAdapters: Map<string, ProtocolAdapter>;
  sessionResolver: SessionResolver;
  sessionRepository: SessionRepository;
  exchangeRepository: ExchangeRepository;
  historyMaintenance: HistoryMaintenanceService;
}

export class CapturePipeline {
  constructor(private readonly deps: CapturePipelineDependencies) {}

  process(exchange: CapturedExchange): { sessionId: string } {
    const provider = this.deps.providerCatalog.get(exchange.providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${exchange.providerId}`);
    }

    const adapter = this.deps.protocolAdapters.get(provider.protocolAdapterId);
    if (!adapter) {
      throw new Error(`Missing protocol adapter: ${provider.protocolAdapterId}`);
    }

    const normalized = adapter.normalize(exchange);
    const inspector = adapter.buildInspector(exchange, normalized);
    const sessionId = this.deps.sessionRepository.transaction(() => {
      const resolvedSessionId = this.deps.sessionResolver.resolve(
        exchange,
        normalized,
        adapter.sessionMatcher,
      );

      this.deps.exchangeRepository.save({
        sessionId: resolvedSessionId,
        capturedExchange: exchange,
        normalizedExchange: normalized,
        inspectorDocument: inspector,
      });
      this.deps.historyMaintenance.enforceRetentionLimit();

      return resolvedSessionId;
    });

    return { sessionId };
  }
}
