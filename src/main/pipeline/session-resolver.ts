import type {
  CapturedExchange,
  NormalizedExchange,
  SessionCandidate,
  SessionMatcher,
} from "../../shared/contracts";
import {
  SessionRepository,
  type SessionRow,
} from "../storage/session-repository";

function safeParseMatcher(json: string | null): unknown {
  try {
    return JSON.parse(json ?? "{}");
  } catch {
    return {};
  }
}

function mapCandidate(row: SessionRow): SessionCandidate {
  return {
    sessionId: row.session_id,
    providerId: row.provider_id,
    profileId: row.profile_id,
    updatedAt: row.updated_at,
    matcherState: safeParseMatcher(row.matcher_state_json),
  };
}

export class SessionResolver {
  constructor(private readonly sessionRepository: SessionRepository) {}

  resolve(
    exchange: CapturedExchange,
    normalized: NormalizedExchange,
    matcher: SessionMatcher,
  ): string {
    const hint = matcher.extractHint(exchange, normalized);
    if (hint) {
      const existing = this.sessionRepository.getByExternalHint(
        exchange.providerId,
        exchange.profileId,
        hint,
      );
      if (existing) {
        const sessionId = existing.session_id;
        this.sessionRepository.upsert({
          sessionId,
          providerId: exchange.providerId,
          profileId: exchange.profileId,
          externalHint: hint,
          title: matcher.deriveTitle(normalized) ?? existing.title,
          model: normalized.model ?? existing.model,
          startedAt: existing.started_at,
          updatedAt: exchange.startedAt,
          exchangeCount: existing.exchange_count + 1,
          matcherState: matcher.updateState(
            safeParseMatcher(existing.matcher_state_json),
            exchange,
            normalized,
          ),
        });
        return sessionId;
      }
    }

    const candidates = this.sessionRepository
      .listCandidates(exchange.providerId, exchange.profileId)
      .map(mapCandidate);
    const match = matcher.match(exchange, normalized, candidates);
    if (match) {
      const existing = this.sessionRepository.getById(match.sessionId);
      if (!existing) {
        throw new Error(`Matched unknown session: ${match.sessionId}`);
      }
      this.sessionRepository.upsert({
        sessionId: match.sessionId,
        providerId: exchange.providerId,
        profileId: exchange.profileId,
        externalHint: hint,
        title: matcher.deriveTitle(normalized) ?? existing.title,
        model: normalized.model ?? existing.model,
        startedAt: existing.started_at,
        updatedAt: exchange.startedAt,
        exchangeCount: existing.exchange_count + 1,
        matcherState: match.nextState,
      });
      return match.sessionId;
    }

    const sessionId = crypto.randomUUID();
    this.sessionRepository.upsert({
      sessionId,
      providerId: exchange.providerId,
      profileId: exchange.profileId,
      externalHint: hint,
      title: matcher.deriveTitle(normalized) ?? normalized.model ?? "Session",
      model: normalized.model,
      startedAt: exchange.startedAt,
      updatedAt: exchange.startedAt,
      exchangeCount: 1,
      matcherState: matcher.createState(exchange, normalized),
    });
    return sessionId;
  }
}
