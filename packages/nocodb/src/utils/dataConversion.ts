import { Logger } from '@nestjs/common';
import { UITypes } from 'nocodb-sdk';
import type { AIRecordType } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type KnexClient from '~/db/sql-client/lib/KnexClient';
import type { NcContext } from '~/interface/config';
import type { User } from '~/models';
import { Column, FileReference, Model, Source } from '~/models';
import { collectAttachmentStorageRefs } from '~/helpers/attachmentHelpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

const logger = new Logger('DataConversion');

// Text held before a column became an Attachment was never checked, yet reads sign it: keep only held files.
export const dropUnheldConvertedAttachments = async (args: {
  context: NcContext;
  table: Model;
  column: Column;
  baseModel: BaseModelSqlv2;
  userId?: string;
}) => {
  const { context, table, column, baseModel, userId } = args;
  const knex = baseModel.dbDriver;
  const tnPath = baseModel.getTnPath(table.table_name);

  const cleanValues = async (values: unknown[]) => {
    const lists = new Map<string, unknown[]>();
    for (const value of values) {
      if (typeof value !== 'string' || lists.has(value)) continue;
      try {
        const list = JSON.parse(value);
        if (Array.isArray(list)) lists.set(value, list);
      } catch {
        // Not a list, so reads never sign it.
      }
    }
    const refs = [...lists.values()].flatMap(collectAttachmentStorageRefs);
    if (!refs.length) return new Map<string, string | null>();

    const held = await FileReference.listHeldFileUrls(
      { baseId: context.base_id, userId },
      refs,
    );
    const cleaned = new Map<string, string | null>();
    for (const [value, list] of lists) {
      const kept = list.filter((item) =>
        collectAttachmentStorageRefs(item).every((ref) => held.has(ref)),
      );
      if (kept.length < list.length) {
        cleaned.set(value, kept.length ? JSON.stringify(kept) : null);
      }
    }
    return cleaned;
  };

  const pk = table.primaryKeys?.length === 1 ? table.primaryKey : undefined;
  if (!pk && !baseModel.isOracle) {
    const values = await knex(tnPath)
      .distinct(column.column_name)
      .whereNotNull(column.column_name)
      .pluck(column.column_name);
    for (const [value, next] of await cleanValues(values)) {
      await knex(tnPath)
        .where(column.column_name, value)
        .update({ [column.column_name]: next });
    }
    return;
  }

  // Oracle can't DISTINCT or compare a CLOB (ORA-00932, ORA-22848), so rows without a single pk go by ROWID.
  const keyAlias = 'NC_ROW_KEY';
  const keyRef = pk ? knex.raw('??', [pk.column_name]) : knex.raw('ROWID');

  let after: string | number | undefined;
  for (;;) {
    const query = knex(tnPath)
      .select({ [keyAlias]: keyRef }, column.column_name)
      .whereNotNull(column.column_name)
      .orderByRaw('?', [keyRef])
      .limit(1000);
    if (after !== undefined) query.whereRaw('? > ?', [keyRef, after]);
    const rows = await query;
    if (!rows.length) break;

    const cleaned = await cleanValues(
      rows.map((row) => row[column.column_name]),
    );
    for (const row of rows) {
      const value = row[column.column_name];
      if (!cleaned.has(value)) continue;
      const next = cleaned.get(value);
      // An edit since the read passed the write check, so it is kept.
      if (!baseModel.isOracle) {
        await knex(tnPath)
          .whereRaw('? = ?', [keyRef, row[keyAlias]])
          .where(column.column_name, value)
          .update({ [column.column_name]: next });
        continue;
      }
      // Oracle can't compare a CLOB in a WHERE: lock the row and compare here.
      await knex.transaction(async (trx) => {
        const [current] = await trx(tnPath)
          .select(column.column_name)
          .whereRaw('? = ?', [keyRef, row[keyAlias]])
          .forUpdate();
        if (current?.[column.column_name] !== value) return;
        await trx(tnPath)
          .whereRaw('? = ?', [keyRef, row[keyAlias]])
          .update({ [column.column_name]: next });
      });
    }
    after = rows[rows.length - 1][keyAlias];
  }
};

// Cleans a field marked by a conversion to Attachment, then unmarks it; a failure keeps the mark, so reads stay strict.
export const finishAttachmentConversion = async (
  context: NcContext,
  param: { columnId: string; userId?: string; baseModel?: BaseModelSqlv2 },
) => {
  const column = await Column.get(context, { colId: param.columnId });
  if (!column?.internal_meta?.attachment_cleanup_pending) return;

  const source = await Source.get(context, column.source_id);
  // External-source reads sign only held files anyway.
  if (column.uidt === UITypes.Attachment && source?.isMeta()) {
    const table = await Model.getWithInfo(context, { id: column.fk_model_id });
    await dropUnheldConvertedAttachments({
      context,
      table,
      column,
      baseModel:
        param.baseModel ??
        (await Model.getBaseModelSQL(context, {
          model: table,
          dbDriver: await NcConnectionMgrv2.get(source),
        })),
      userId: param.userId,
    });
  }
  await Column.setAttachmentCleanupPending(context, {
    colId: column.id,
    pending: false,
  });
};

// After a committed meta apply, a failed cleanup is logged rather than thrown: its mark keeps reads strict.
export const finishAttachmentConversions = async (
  context: NcContext,
  columnIds: string[],
  userId?: string,
) => {
  for (const columnId of columnIds) {
    try {
      await finishAttachmentConversion(context, { columnId, userId });
    } catch (e) {
      logger.error(
        `Cleaning field ${columnId} after its conversion to Attachment failed: ${e?.message}`,
        e?.stack,
      );
    }
  }
};

export const convertAIRecordTypeToValue = async (args: {
  source: Source;
  table: Model;
  column: Column;
  baseModel: BaseModelSqlv2;
  sqlClient: KnexClient;
}) => {
  const { source, table, column, baseModel, sqlClient } = args;

  if (source.type === 'pg') {
    await sqlClient.raw(
      `UPDATE ??
        SET ?? = TRIM('"' FROM (??::jsonb->>'value'))
        WHERE ?? ~ '^\\s*\\{.*\\}\\s*$' AND jsonb_typeof(??::jsonb) = 'object' AND (??::jsonb->'value') IS NOT NULL;`,
      [
        baseModel.getTnPath(table.table_name),
        column.column_name,
        column.column_name,
        column.column_name,
        column.column_name,
        column.column_name,
      ],
    );
  } else if (source.type === 'mysql' || source.type === 'mysql2') {
    await sqlClient.raw(
      `UPDATE ??
        SET ?? = JSON_UNQUOTE(JSON_EXTRACT(??, '$.value'))
        WHERE JSON_VALID(??) AND JSON_TYPE(??) = 'OBJECT' AND JSON_EXTRACT(??, '$.value') IS NOT NULL;`,
      [
        baseModel.getTnPath(table.table_name),
        column.column_name,
        column.column_name,
        column.column_name,
        column.column_name,
        column.column_name,
      ],
    );
  } else if (source.type === 'sqlite3') {
    await sqlClient.raw(
      `UPDATE ??
        SET ?? = json_extract(??, '$.value')
        WHERE json_valid(??) AND json_extract(??, '$.value') IS NOT NULL;`,
      [
        baseModel.getTnPath(table.table_name),
        column.column_name,
        column.column_name,
        column.column_name,
        column.column_name,
      ],
    );
  }
};

export const convertValueToAIRecordType = async (args: {
  source: Source;
  table: Model;
  column: Column;
  baseModel: BaseModelSqlv2;
  sqlClient: KnexClient;
  user: User;
}) => {
  const { source, table, column, baseModel, sqlClient, user } = args;

  const commonRecord: Omit<AIRecordType, 'value'> = {
    lastModifiedBy: user.id,
    lastModifiedTime: baseModel.now(),
    isStale: true,
  };

  // update every record with json which holds old value in value prop & commonRecord props in lastModifiedBy, lastModifiedTime, isStale
  if (source.type === 'pg') {
    await sqlClient.raw(
      `UPDATE ??
        SET ?? = jsonb_build_object('value', ??, 'lastModifiedBy', ?::text, 'lastModifiedTime', ?::text, 'isStale', ?::boolean)
        WHERE ?? is not null;`,
      [
        baseModel.getTnPath(table.table_name),
        column.column_name,
        column.column_name,
        commonRecord.lastModifiedBy.toString(),
        commonRecord.lastModifiedTime.toString(),
        commonRecord.isStale,
        column.column_name,
      ],
    );
  } else if (source.type === 'mysql' || source.type === 'mysql2') {
    await sqlClient.raw(
      `UPDATE ??
        SET ?? = JSON_OBJECT('value', ??, 'lastModifiedBy', ?, 'lastModifiedTime', ?, 'isStale', ?)
        WHERE ?? is not null;`,
      [
        baseModel.getTnPath(table.table_name),
        column.column_name,
        column.column_name,
        commonRecord.lastModifiedBy.toString(),
        commonRecord.lastModifiedTime.toString(),
        commonRecord.isStale,
        column.column_name,
      ],
    );
  } else if (source.type === 'sqlite3') {
    await sqlClient.raw(
      `UPDATE ??
        SET ?? = json_object('value', ??, 'lastModifiedBy', ?, 'lastModifiedTime', ?, 'isStale', ?)
        WHERE ?? is not null;`,
      [
        baseModel.getTnPath(table.table_name),
        column.column_name,
        column.column_name,
        commonRecord.lastModifiedBy.toString(),
        commonRecord.lastModifiedTime.toString(),
        commonRecord.isStale,
        column.column_name,
      ],
    );
  } else if (source.type === 'mssql') {
    // T-SQL has no `JSON_OBJECT` — synthesize the same JSON shape via a
    // single-row derived `SELECT ... FOR JSON PATH, WITHOUT_ARRAY_WRAPPER`.
    // `STRING_ESCAPE(..., 'json')` would also work as a manual concat, but
    // the derived-table form is simpler and handles nesting + nulls.
    // Casting isStale to BIT in the subquery so FOR JSON emits a proper
    // `true`/`false` literal (vs. quoted string).
    await sqlClient.raw(
      `UPDATE ??
        SET ?? = (
          SELECT ?? AS [value],
                 ? AS [lastModifiedBy],
                 ? AS [lastModifiedTime],
                 CAST(? AS BIT) AS [isStale]
          FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )
        WHERE ?? IS NOT NULL`,
      [
        baseModel.getTnPath(table.table_name),
        column.column_name,
        column.column_name,
        commonRecord.lastModifiedBy.toString(),
        commonRecord.lastModifiedTime.toString(),
        commonRecord.isStale ? 1 : 0,
        column.column_name,
      ],
    );
  }
};
