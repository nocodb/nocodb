import { Injectable, Logger } from '@nestjs/common';
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
  if (
    (source.type !== 'pg' && source.type !== 'mssql') ||
    source.isMeta()
  ) {
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

  async job() {
    const ncMeta = Noco.ncMeta;

    // External (non-meta, non-local) pg/mssql sources that aren't deleted. Read
    // ids only — decryption + integration-config inheritance are handled via the
    // model.
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
    const rows = await ncMeta
      .knexConnection(MetaTable.SOURCES)
      .whereIn('type', ['pg', 'mssql'])
      .whereNotNull('fk_integration_id')
      .where(function () {
        this.where('is_meta', false).orWhereNull('is_meta');
      })
      .where(function () {
        this.where('is_local', false).orWhereNull('is_local');
      })
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      })
      .select('id', 'base_id', 'fk_workspace_id', 'type');

    this.logger.log(
      `Found ${rows.length} candidate source(s) (external integration-backed pg/mssql) to evaluate`,
    );

    let pinned = 0;

    for (const row of rows) {
      try {
        const context = {
          workspace_id: row.fk_workspace_id,
          base_id: row.base_id,
        };

        // Source.get joins the integration config, so getConfig() reflects the
        // POST-fix effective searchPath (source override, else integration).
        const source = await Source.get(context, row.id, false, ncMeta);
        if (!source) continue;

        const searchPath = grandfatherSearchPath(source);
        if (!searchPath) continue;

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
        await NcConnectionMgrv2.resetSource(source.id);
        pinned++;

        // Per-pin audit line — this migration mutates source config, so record
        // exactly which sources were changed and to what.
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
      `Pinned ${pinned} external pg/mssql source(s) to their default schema to preserve pre-fix behaviour`,
    );

    return true;
  }
}
