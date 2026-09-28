import { Injectable, Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import Source from '~/models/Source';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

/**
 * Grandfather existing EXTERNAL PG/MSSQL sources to their current schema.
 *
 * Before the searchPath-clobber fix, an external PG/MSSQL source whose schema
 * lived on the integration config (and not on the source config) had its
 * `searchPath` erased by `Source.getConfig()`, so it silently bound to the DB
 * default schema (`public` for pg, `dbo` for mssql). The fix makes getConfig()
 * inherit the integration's `searchPath` — which would retroactively flip such
 * a source from the default schema to the integration's schema on the next
 * connection refresh, changing which tables/data an existing base reads.
 *
 * To keep every existing base exactly as it is today, pin those sources' OWN
 * config `searchPath` to the default schema (a source-level override wins in
 * getConfig), preserving current behaviour. New sources are unaffected; admins
 * opt in per-source by setting the schema (now honoured).
 *
 * Scope: EXTERNAL, integration-backed pg/mssql sources only — meta sources,
 * integration-less sources, and other client types are untouched. Idempotent:
 * a source that already carries a source-level `searchPath` is skipped, so a
 * re-run is a no-op. Each pinned source's cached connection is reset so the
 * running instance rebuilds against the pinned schema immediately (see below).
 */
/**
 * Decide the source-level `searchPath` to pin so an existing external PG/MSSQL
 * source keeps the schema it read before the searchPath-clobber fix.
 *
 * Returns the array to write to the SOURCE config, or `null` when the source
 * needs no change:
 *  - non-pg/mssql or meta sources -> null (out of scope)
 *  - a source that already has its own `searchPath` -> null (unchanged by fix)
 *  - a source whose post-fix effective schema is already the DB default -> null
 *    (no behaviour change)
 *  - otherwise -> `[defaultSchema]` (`public` for pg, `dbo` for mssql), pinning
 *    it to what it read before so the fix doesn't flip it.
 */
export function grandfatherSearchPath(source: Source): string[] | null {
  // External only — skip the meta / local base source.
  if ((source.type !== 'pg' && source.type !== 'mssql') || source.isMeta()) {
    return null;
  }

  // A source-level searchPath was honoured before and after the fix.
  const ownConfig = source.getSourceConfig();
  if (ownConfig?.searchPath?.length) return null;

  const defaultSchema = source.type === 'mssql' ? 'dbo' : 'public';

  // Post-fix effective schema now inherits the integration. Only a non-default
  // value would change behaviour.
  const effectiveSchema = source.getConfig()?.searchPath?.[0];
  if (!effectiveSchema || effectiveSchema === defaultSchema) return null;

  return [defaultSchema];
}

@Injectable()
export class PgSourceSearchPathBackfillMigration {
  private readonly logger = new Logger(
    PgSourceSearchPathBackfillMigration.name,
  );

  // Read the candidate set in keyset-paginated pages. Loading every row up
  // front is an unbounded memory load on instances with many (10k+) external
  // sources, so we page by `id` and process each page before fetching the
  // next. Keyset (`id > lastId`) — not OFFSET — keeps every page a flat index
  // scan instead of re-walking all skipped rows.
  static readonly BATCH_SIZE = 500;

  async job() {
    const ncMeta = Noco.ncMeta;

    // Snapshot the start time and only grandfather sources that already exist.
    // Unlike the previous single snapshot-`select`, the keyset walk can reach a
    // page for a source created WHILE the migration runs (ids are random
    // nanoids, so a new row may land in an unvisited page). Such a source is
    // brand-new user config, not legacy pre-fix data — pinning it to `public`
    // would clobber the schema the user just set. Bounding by `created_at`
    // closes that window; the count uses the same filter so `total` stays
    // consistent with what's iterated.
    //
    // Use ncMeta.now() (client-aware), NOT `new Date()`: `created_at` is stored
    // as a string in ncMeta.now()'s format, and on a SQLite meta DB a bound
    // Date binds as a numeric (node-sqlite3), so `TEXT < numeric` is ALWAYS
    // false (SQLite storage-class ordering) — the job would find 0 candidates
    // and grandfather nothing. MySQL has an analogous timezone-offset bug. Only
    // PG (Cloud) tolerates a raw Date. Matching the stored format fixes all.
    const startedAt = ncMeta.now();

    // Candidate filter for external (non-meta, non-local, non-deleted) pg/mssql
    // sources backed by an integration.
    //
    // The is_meta/is_local filter mirrors grandfatherSearchPath's `isMeta()`
    // guard (which is `is_meta || is_local`): a local source reads from the
    // meta/data DB, not an external integration schema, so it's never pinned.
    // Filtering here keeps the query and the guard in agreement.
    //
    // Only integration-backed sources can need pinning: grandfatherSearchPath
    // skips a source that carries its own searchPath, and a source with no
    // integration has no other place for a non-default schema to come from — so
    // its effective schema is the DB default and it's skipped. Filtering to
    // `fk_integration_id IS NOT NULL` keeps this cheap on instances with many
    // (10k+) external sources without missing any source that would be pinned.
    const applyCandidateFilter = (qb: Knex.QueryBuilder) =>
      qb
        .whereIn(`${MetaTable.SOURCES}.type`, ['pg', 'mssql'])
        .whereNotNull(`${MetaTable.SOURCES}.fk_integration_id`)
        .where(`${MetaTable.SOURCES}.created_at`, '<', startedAt)
        .where(function () {
          this.where(`${MetaTable.SOURCES}.is_meta`, false).orWhereNull(
            `${MetaTable.SOURCES}.is_meta`,
          );
        })
        .where(function () {
          this.where(`${MetaTable.SOURCES}.is_local`, false).orWhereNull(
            `${MetaTable.SOURCES}.is_local`,
          );
        })
        .where(function () {
          this.where(`${MetaTable.SOURCES}.deleted`, false).orWhereNull(
            `${MetaTable.SOURCES}.deleted`,
          );
        });

    const total = await applyCandidateFilter(
      ncMeta.knexConnection(MetaTable.SOURCES),
    )
      .count(`${MetaTable.SOURCES}.id as count`)
      .first()
      .then((r) => Number(r?.count ?? 0));

    this.logger.log(
      `Found ${total} candidate source(s) (external integration-backed pg/mssql) to evaluate`,
    );

    let pinned = 0;
    let evaluated = 0;
    let lastId = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // One join per page pulls each source's own config AND its integration
      // config in a single round-trip, so grandfatherSearchPath runs entirely
      // in memory — no per-source Source.get() round-trip (the old N+1). The
      // join + selected columns mirror Source.extendQb/castType so the
      // in-memory Source behaves identically to Source.get().
      const rows = await applyCandidateFilter(
        ncMeta.knexConnection(MetaTable.SOURCES),
      )
        .leftJoin(
          MetaTable.INTEGRATIONS,
          `${MetaTable.SOURCES}.fk_integration_id`,
          `${MetaTable.INTEGRATIONS}.id`,
        )
        .where(`${MetaTable.SOURCES}.id`, '>', lastId)
        .orderBy(`${MetaTable.SOURCES}.id`, 'asc')
        .limit(PgSourceSearchPathBackfillMigration.BATCH_SIZE)
        .select(
          `${MetaTable.SOURCES}.*`,
          `${MetaTable.INTEGRATIONS}.config as integration_config`,
        );

      if (!rows.length) break;
      lastId = rows[rows.length - 1].id;

      for (const row of rows) {
        evaluated++;
        try {
          // Hydrate a Source from the joined row (source config +
          // integration_config). getConfig()/getSourceConfig() decrypt and
          // merge in memory, so this reflects the POST-fix effective searchPath
          // (source override, else integration) with no extra query.
          const source = new Source(row);

          const searchPath = grandfatherSearchPath(source);
          if (!searchPath) continue;

          const context = {
            workspace_id: row.fk_workspace_id,
            base_id: row.base_id,
          };

          await Source.update(
            context,
            source.id,
            {
              config: { ...(source.getSourceConfig() || {}), searchPath },
            },
            ncMeta,
          );

          // Source.update only bumps the Redis version — it does NOT tear down
          // this instance's cached knex connection (its own comment says config
          // changing callers must resetSource() themselves). Without this, the
          // instance running the job keeps serving the pre-pin (integration,
          // non-default) schema connection until restart, because its local
          // version already equals the bumped one so the staleness check never
          // fires. resetSource() deletes the local ref then bumps, so this
          // instance rebuilds against the pinned schema on the next connection
          // and every other instance invalidates via the version bump.
          await NcConnectionMgrv2.resetSource(source);
          pinned++;

          // Per-pin audit line — this migration mutates source config, so
          // record exactly which sources were changed and to what.
          this.logger.log(
            `Pinned source ${source.id} (base ${row.base_id}) searchPath -> [${searchPath[0]}]`,
          );
        } catch (e) {
          this.logger.error(
            `Failed to backfill searchPath for source ${row.id}: ${e.message}`,
            e.stack,
          );
        }
      }

      this.logger.log(
        `searchPath backfill progress: evaluated ${evaluated}/${total}, pinned ${pinned} so far`,
      );
    }

    this.logger.log(
      `Pinned ${pinned} external pg/mssql source(s) to their default schema to preserve pre-fix behaviour`,
    );

    return true;
  }
}
