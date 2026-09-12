import { Logger } from '@nestjs/common';

const perfLogger = new Logger('Perf');

/**
 * Per-stage wall-clock timer for hot read/write paths.
 *
 * Enable with `NC_PERF_LOG=true` (also honoured: any `ENABLE_PROFILER` value,
 * for parity with {@link Profiler}). When disabled, {@link StageTimer.start}
 * returns `null` so every `timer?.mark()` / `timer?.end()` collapses to a cheap
 * null check — effectively zero overhead in production.
 *
 * Each `end()` emits one structured line via the NestJS logger:
 *
 *   [Perf] execAndParse total=8801.2ms dbQuery=8203.4 attachment=2.1 date=30.5 \
 *     user=12.0 json=450.8 substitute=98.1 | rows=100 client=mssql
 *
 * `toJSON()` exposes the same breakdown for surfacing in a response `stats`
 * block so the split is visible client-side without trawling server logs.
 */
export const PERF_LOG_ENABLED =
  process.env.NC_PERF_LOG === 'true' || !!process.env.ENABLE_PROFILER;

export class StageTimer {
  private readonly t0 = process.hrtime.bigint();

  private last = this.t0;

  private readonly stages: Array<[string, number]> = [];

  private readonly meta: Record<string, string | number | boolean> = {};

  private constructor(private readonly label: string) {}

  /** Returns a timer only when perf logging is enabled, else `null`. */
  static start(label: string): StageTimer | null {
    return PERF_LOG_ENABLED ? new StageTimer(label) : null;
  }

  /** Record the elapsed ms since the previous mark (or start) under `stage`. */
  mark(stage: string): void {
    const now = process.hrtime.bigint();
    this.stages.push([stage, Number(now - this.last) / 1e6]);
    this.last = now;
  }

  /** Attach contextual metadata (rows, client, cacheHit, …). */
  set(key: string, value: string | number | boolean): void {
    this.meta[key] = value;
  }

  /** Total ms since start, without finalising. */
  totalMs(): number {
    return Number(process.hrtime.bigint() - this.t0) / 1e6;
  }

  /** Structured breakdown — for embedding in a response `stats` block. */
  toJSON(): Record<string, any> {
    return {
      label: this.label,
      totalMs: +this.totalMs().toFixed(2),
      stages: Object.fromEntries(
        this.stages.map(([s, ms]) => [s, +ms.toFixed(2)]),
      ),
      ...this.meta,
    };
  }

  /** Emit the breakdown line. */
  end(logger: Logger = perfLogger): void {
    const total = this.totalMs().toFixed(1);
    const stages = this.stages
      .map(([s, ms]) => `${s}=${ms.toFixed(1)}`)
      .join(' ');
    const meta = Object.entries(this.meta)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    // info level: NC_PERF_LOG is an explicit opt-in, so the breakdown should
    // surface regardless of the global (pino) debug level being off.
    logger.log(
      `${this.label} total=${total}ms ${stages}${meta ? ` | ${meta}` : ''}`,
    );
  }
}
