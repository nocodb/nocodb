import { Injectable, Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import Source from '~/models/Source';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

/**
 * Repair columns left `NOT NULL` with no default by the AutoNumber conversion bug.
 *
 * An AutoNumber column is added as `bigserial` (`bigint NOT NULL DEFAULT
 * nextval(...)`), but the DDL generator's `n.ai` branch never emitted a NOT NULL
 * clause, so metadata kept `rqd: false`. Converting the field away then dropped
 * the sequence default without dropping NOT NULL — because the nullability
 * statement is only emitted on an `n.rqd !== o.rqd` diff, and both sides were
 * false. The result is a `NOT NULL` column that nothing populates, so every
 * insert into the table fails with 23502. Trashing the field hides it from the
 * UI while keeping the constraint, leaving no in-product way to recover.
 *
 * PgClient now drops NOT NULL alongside the default when a column loses
 * auto-increment, so new conversions are fine. This job heals bases already in
 * that state by realigning the physical column with what metadata claims.
 *
 * Scope: INTERNAL (meta/local) pg sources only — those have no other repair
 * path. External sources can be healed by running meta sync, which propagates
 * `rqd` from the live schema (`meta-diffs.service.ts` TABLE_COLUMN_PROPS_CHANGED),
 * and we don't issue DDL against a customer-owned database.
 *
 * Only ever relaxes a constraint, and only where metadata says the column is
 * nullable — pk, auto-increment, and genuinely-required (`rqd: true`) columns are
 * left alone, as is any physical column with no metadata row. Writes no
 * metadata, so there is no cache to invalidate. Idempotent: a repaired column no
 * longer matches the candidate query.
 */
@Injectable()
export class AutoNumberNotNullRepairMigration {
  private readonly logger = new Logger(AutoNumberNotNullRepairMigration.name);

  // Page the source walk by `id` rather than loading every internal source up
  // front — mirrors nc_job_015's keyset pagination.
  static readonly BATCH_SIZE = 500;

  async job() {
    const ncMeta = Noco.ncMeta;

    // Internal pg sources: `isMeta()` is `is_meta || is_local`, so match both.
    const applyCandidateFilter = (qb: Knex.QueryBuilder) =>
      qb
        .where(`${MetaTable.SOURCES}.type`, 'pg')
        .where(function () {
          this.where(`${MetaTable.SOURCES}.is_meta`, true).orWhere(
            `${MetaTable.SOURCES}.is_local`,
            true,
          );
        })
        .where(function () {
          this.where(`${MetaTable.SOURCES}.deleted`, false).orWhereNull(
            `${MetaTable.SOURCES}.deleted`,
          );
        });

    let repaired = 0;
    let sourcesScanned = 0;
    let lastId = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows = await applyCandidateFilter(
        ncMeta.knexConnection(MetaTable.SOURCES),
      )
        .where(`${MetaTable.SOURCES}.id`, '>', lastId)
        .orderBy(`${MetaTable.SOURCES}.id`, 'asc')
        .limit(AutoNumberNotNullRepairMigration.BATCH_SIZE)
        .select(`${MetaTable.SOURCES}.*`);

      if (!rows.length) break;
      lastId = rows[rows.length - 1].id;

      for (const row of rows) {
        sourcesScanned++;
        try {
          repaired += await this.repairSource(new Source(row), ncMeta);
        } catch (e) {
          this.logger.error(
            `Failed to repair NOT NULL columns for source ${row.id}: ${e.message}`,
            e.stack,
          );
        }
      }
    }

    this.logger.log(
      `AutoNumber NOT NULL repair complete: scanned ${sourcesScanned} internal pg source(s), relaxed ${repaired} column(s)`,
    );

    return true;
  }

  private async repairSource(source: Source, ncMeta): Promise<number> {
    // Internal sources resolve their schema off the source config (see
    // Model.getBaseModelSQL) and keep every table in that one schema, so a
    // single information_schema query covers the whole source.
    const schema = source.getConfig()?.schema;
    if (!schema) return 0;

    // Physical columns that cannot be satisfied: NOT NULL with nothing to
    // supply a value. Identity columns are excluded — they generate their own
    // values despite reporting no column_default.
    const knex = await NcConnectionMgrv2.get(source);
    const suspects = await knex
      .select('table_name', 'column_name')
      .from('information_schema.columns')
      .where('table_schema', schema)
      .where('is_nullable', 'NO')
      .whereNull('column_default')
      .where('is_identity', 'NO');

    if (!suspects.length) return 0;

    // Metadata's view of the same columns, restricted to ones it believes are
    // nullable and does not auto-populate. Anything absent here (an orphan
    // physical column, or one metadata genuinely marks required) is skipped.
    const nullableInMeta = await ncMeta
      .knexConnection(`${MetaTable.COLUMNS} as c`)
      .join(`${MetaTable.MODELS} as m`, 'm.id', 'c.fk_model_id')
      .where('c.source_id', source.id)
      .where((qb) => qb.where('c.rqd', false).orWhereNull('c.rqd'))
      .where((qb) => qb.where('c.pk', false).orWhereNull('c.pk'))
      .where((qb) => qb.where('c.ai', false).orWhereNull('c.ai'))
      .select('m.table_name', 'c.column_name', 'c.id as column_id');

    // table_name -> column_name -> column id. Nested rather than a composite
    // string key, so no delimiter can collide with a table or column name.
    const repairable = new Map<string, Map<string, string>>();
    for (const c of nullableInMeta) {
      if (!c.table_name || !c.column_name) continue;
      let byColumn = repairable.get(c.table_name);
      if (!byColumn) {
        byColumn = new Map<string, string>();
        repairable.set(c.table_name, byColumn);
      }
      byColumn.set(c.column_name, c.column_id);
    }

    let repaired = 0;
    for (const s of suspects) {
      const columnId = repairable.get(s.table_name)?.get(s.column_name);
      if (!columnId) continue;

      await knex.raw('ALTER TABLE ??.?? ALTER COLUMN ?? DROP NOT NULL', [
        schema,
        s.table_name,
        s.column_name,
      ]);
      repaired++;

      // Per-column audit line — this migration issues DDL, so record exactly
      // which columns were relaxed.
      this.logger.log(
        `Dropped NOT NULL on ${schema}.${s.table_name}.${s.column_name} (column ${columnId}, base ${source.base_id})`,
      );
    }

    return repaired;
  }
}
