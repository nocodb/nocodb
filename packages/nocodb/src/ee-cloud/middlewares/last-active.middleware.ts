import { Injectable, Logger } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

const DEBOUNCE_MS = 5 * 60_000;

// Cap the in-memory seen-set to bound memory usage. When we hit the cap we
// evict the oldest 10% by insertion order (Map preserves insertion order).
const MAX_TRACKED = 10_000;
const EVICT_KEEP_RATIO = 0.9;

/**
 * Stamps `nc_users_v2.last_active_at` once per user per `DEBOUNCE_MS` window.
 * Only runs for authenticated requests — invited users who never sign in keep
 * `last_active_at = NULL`, and the nudge scanner uses that to skip them.
 *
 * The update is fire-and-forget: hot-path requests don't block on the write.
 */
@Injectable()
export class LastActiveMiddleware implements NestMiddleware {
  private logger = new Logger(LastActiveMiddleware.name);
  private lastSeen = new Map<string, number>();

  use(req: Request, _res: Response, next: NextFunction): void {
    const userId = (req as any).user?.id;
    if (!userId) return next();

    const now = Date.now();
    const prev = this.lastSeen.get(userId) ?? 0;
    if (now - prev < DEBOUNCE_MS) return next();

    if (this.lastSeen.size >= MAX_TRACKED) {
      const toDelete =
        this.lastSeen.size - Math.floor(MAX_TRACKED * EVICT_KEEP_RATIO);
      let i = 0;
      for (const k of this.lastSeen.keys()) {
        if (i++ >= toDelete) break;
        this.lastSeen.delete(k);
      }
    }
    this.lastSeen.set(userId, now);

    Noco.ncMeta
      .knexConnection(MetaTable.USERS)
      .where({ id: userId })
      .update({ last_active_at: new Date(now) })
      .catch((e) =>
        this.logger.warn(
          `last_active update failed user=${userId}: ${e.message}`,
        ),
      );

    next();
  }
}
