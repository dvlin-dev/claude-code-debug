import { DEFAULT_MAX_STORED_EXCHANGES } from "../../shared/defaults";
import type { ExchangeRepository } from "./exchange-repository";
import type { SessionRepository } from "./session-repository";

export interface HistoryMaintenanceDependencies {
  sessionRepository: Pick<
    SessionRepository,
    "transaction" | "listSessions" | "clearAll" | "deleteByIds"
  >;
  exchangeRepository: Pick<
    ExchangeRepository,
    "clearAll" | "deleteBySessionIds"
  >;
  maxStoredExchanges?: number;
}

export class HistoryMaintenanceService {
  private readonly maxStoredExchanges: number;

  constructor(private readonly deps: HistoryMaintenanceDependencies) {
    this.maxStoredExchanges =
      deps.maxStoredExchanges ?? DEFAULT_MAX_STORED_EXCHANGES;
  }

  clearAll(): void {
    this.deps.sessionRepository.transaction(() => {
      this.deps.exchangeRepository.clearAll();
      this.deps.sessionRepository.clearAll();
    });
  }

  enforceRetentionLimit(): string[] {
    if (this.maxStoredExchanges <= 0) {
      return [];
    }

    return this.deps.sessionRepository.transaction(() => {
      const sessions = this.deps.sessionRepository.listSessions();
      let retainedExchangeCount = 0;
      const sessionIdsToDelete: string[] = [];

      for (const session of sessions) {
        const sessionExchangeCount = Math.max(0, session.exchange_count);
        const shouldKeep =
          retainedExchangeCount === 0 ||
          retainedExchangeCount + sessionExchangeCount <=
            this.maxStoredExchanges;

        if (shouldKeep) {
          retainedExchangeCount += sessionExchangeCount;
          continue;
        }

        sessionIdsToDelete.push(session.session_id);
      }

      if (sessionIdsToDelete.length === 0) {
        return [];
      }

      this.deps.exchangeRepository.deleteBySessionIds(sessionIdsToDelete);
      this.deps.sessionRepository.deleteByIds(sessionIdsToDelete);
      return sessionIdsToDelete;
    });
  }
}
