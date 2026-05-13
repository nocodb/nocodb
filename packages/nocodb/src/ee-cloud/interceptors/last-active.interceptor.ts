import { Injectable, Logger } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

// 30-min granularity is plenty for the 30-day nudge window. Coarser
// debounce reduces redundant writes across the multi-instance cloud fleet
// (each pod has its own LRU, so worst-case writes scale with pod count).
const DEBOUNCE_MS = 30 * 60_000;

// Bound the in-memory LRU. ~40B per entry → 10k ≈ 400KB. Sized comfortably
// above any realistic per-pod active-user count; the cap is a safety net
// against runaway traffic, not a steady-state constraint.
const MAX_TRACKED = 10_000;

/**
 * Stamps `nc_users_v2.last_active_at` once per user per `DEBOUNCE_MS` window.
 * Only runs for authenticated requests — invited users who never sign in keep
 * `last_active_at = NULL`, and the nudge scanner uses that to skip them.
 *
 * Runs as an interceptor (not a middleware) because NestJS middlewares
 * execute before guards — at that point `req.user` is still undefined.
 * Interceptors run after guards, so auth has populated `req.user` by the
 * time `intercept()` fires.
 *
 * The DB update is fire-and-forget: hot-path requests don't block on it.
 *
 * Hot-path discipline: ~99% of requests fall inside the debounce window and
 * return after a single `Map.get` + compare (~50ns). LRU bookkeeping only
 * happens on the ~1/300 request that actually triggers a DB write.
 *
 * LRU semantics: keyed by last DB-write time, MRU at the tail. On every
 * write we `delete` + `set` so the entry moves to the tail — plain `set`
 * on an existing key would not move it, causing eviction to target the
 * longest-running (most active) users first. Eviction drops one from the
 * head when over cap.
 */
@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  private logger = new Logger(LastActiveInterceptor.name);
  private lastSeen = new Map<string, number>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Fail-open. This runs on every authenticated controller path, so any
    // throw here would 500 the entire request. Stamping is best-effort
    // instrumentation; never let it block or fail the request. The defense
    // is layered: defensive type checks inside `maybeStamp`, an inner
    // try/catch around the knex query build, a `.catch()` on the resulting
    // promise, and this outer try/catch as a last-ditch backstop.
    try {
      this.maybeStamp(context);
    } catch (e) {
      this.safeWarn(`last_active interceptor failed: ${(e as Error)?.message}`);
    }
    return next.handle();
  }

  private maybeStamp(context: ExecutionContext): void {
    const req = context?.switchToHttp?.()?.getRequest?.();
    if (!req || typeof req !== 'object') return;

    const user = (req as any).user;
    if (!user || typeof user !== 'object') return;

    // Skip programmatic auth and public-shared-view hits. `last_active_at`
    // drives onboarding-nudge targeting which is human-facing; integration
    // traffic isn't a signal the user is engaging with the product.
    if (
      user.is_api_token === true ||
      user.is_oauth_token === true ||
      user.isPublicBase === true
    ) {
      return;
    }

    const userId = user.id;
    if (typeof userId !== 'string' || userId.length === 0) return;

    const now = Date.now();
    const lastWrite = this.lastSeen.get(userId) ?? 0;
    if (now - lastWrite < DEBOUNCE_MS) return;

    // Past the debounce gate — bump LRU position and queue the DB write.
    // delete + set moves the key to insertion-order tail (MRU).
    this.lastSeen.delete(userId);
    this.lastSeen.set(userId, now);

    if (this.lastSeen.size > MAX_TRACKED) {
      const lru = this.lastSeen.keys().next().value;
      if (lru !== undefined) this.lastSeen.delete(lru);
    }

    const ncMeta = Noco?.ncMeta;
    if (!ncMeta || typeof ncMeta.knexConnection !== 'function') return;

    let promise: Promise<unknown> | undefined;
    try {
      promise = ncMeta
        .knexConnection(MetaTable.USERS)
        .where({ id: userId })
        .update({ last_active_at: new Date(now) });
    } catch (e) {
      this.safeWarn(
        `last_active query build failed user=${userId}: ${
          (e as Error)?.message
        }`,
      );
      return;
    }

    if (promise && typeof (promise as any).catch === 'function') {
      promise.catch((e) =>
        this.safeWarn(
          `last_active update failed user=${userId}: ${(e as Error)?.message}`,
        ),
      );
    }
  }

  // Logger calls are not expected to throw, but if they ever did we don't
  // want an unhandled exception bubbling out of `.catch()` handlers.
  private safeWarn(msg: string): void {
    try {
      this.logger.warn(msg);
    } catch {
      // intentionally swallowed
    }
  }
}
