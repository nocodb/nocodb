import type { AIRecordType } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type KnexClient from '~/db/sql-client/lib/KnexClient';
import type { Column, Model, Source, User } from '~/models';

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
