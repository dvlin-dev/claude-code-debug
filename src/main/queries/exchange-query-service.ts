import type {
  ExchangeDetailVM,
  InspectorDocument,
  ProviderId,
} from "../../shared/contracts";
import { ExchangeRepository } from "../storage/exchange-repository";
import type { ProviderCatalog } from "../providers/provider-catalog";

function safeParseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn("[ExchangeQueryService] Corrupted JSON in database:", error);
    return fallback;
  }
}

export class ExchangeQueryService {
  constructor(
    private readonly exchangeRepository: ExchangeRepository,
    private readonly providerCatalog: ProviderCatalog,
  ) {}

  getExchangeDetail(exchangeId: string): ExchangeDetailVM | null {
    const row = this.exchangeRepository.getById(exchangeId);
    if (!row) {
      return null;
    }

    const providerId = row.provider_id as ProviderId;
    const provider = this.providerCatalog.get(providerId);
    const normalized = safeParseJson<{ model: string | null }>(
      row.normalized_json as string,
      { model: null },
    );
    const inspector = safeParseJson<InspectorDocument>(
      row.inspector_json as string,
      { sections: [] },
    );

    return {
      exchangeId: row.exchange_id,
      providerId,
      providerLabel: provider?.label ?? providerId,
      method: row.method,
      path: row.path,
      statusCode: row.status_code,
      durationMs: row.duration_ms,
      model: normalized.model ?? null,
      inspector,
    };
  }
}
