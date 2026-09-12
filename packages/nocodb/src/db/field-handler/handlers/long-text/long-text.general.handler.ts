import { NcError } from 'src/helpers/catchError';
import { NC_MAX_TEXT_LENGTH } from 'src/constants';
import { isAIPromptCol, ncIsObject } from 'nocodb-sdk';
import type { AIRecordType, NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column, Filter } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type {
  FilterOptions,
  SortOptions,
} from '~/db/field-handler/field-handler.interface';
import { sanitize } from '~/helpers/sqlSanitize';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class LongTextGeneralHandler extends GenericFieldHandler {
  /**
   * Build the SQL expression that represents a LongText column's effective
   * value. For AI Prompt columns the stored `{ value, prompt, ... }` JSON
   * is extracted via the dialect's JSON function; plain LongText returns
   * the raw column reference. Shared by `filter()` and `applySort()`.
   */
  protected getFieldExpression(
    knex: CustomKnex,
    column: Column,
    alias?: string,
  ): string | Knex.Raw {
    const baseField = alias
      ? `${alias}.${column.column_name}`
      : column.column_name;

    if (!isAIPromptCol(column)) return baseField;

    const client = knex.clientType();
    if (client === 'pg') {
      return knex.raw(`TRIM('"' FROM (??::jsonb->>'value'))`, [
        column.column_name,
      ]);
    }
    if (client.startsWith('mysql')) {
      return knex.raw(`JSON_UNQUOTE(JSON_EXTRACT(??, '$.value'))`, [
        column.column_name,
      ]);
    }
    if (client === 'sqlite3') {
      return knex.raw(`json_extract(??, '$.value')`, [column.column_name]);
    }
    if (client === 'mssql') {
      // T-SQL: JSON_VALUE returns scalar text from a path; matches the
      // unquoted, untyped extraction the other dialects produce.
      return knex.raw(`JSON_VALUE(??, '$.value')`, [column.column_name]);
    }
    if (client === 'oracledb') {
      // Oracle JSON_VALUE (12.2+) extracts scalar text from the CLOB-stored
      // JSON payload — same shape as the mssql extraction.
      return knex.raw(`JSON_VALUE(??, '$.value')`, [column.column_name]);
    }
    return baseField;
  }

  /**
   * AI Prompt LongText routes filtering through the JSON-extract field
   * expression; plain LongText uses the generic text behavior unchanged.
   *
   * MySQL preserves case-sensitive `eq` / `neq` via LongTextMysqlHandler's
   * `filterEq` / `filterNeq` overrides (`BINARY ?? = ?`).
   */
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    if (!isAIPromptCol(column)) {
      return super.filter(knex, filter, column, options);
    }

    const aiField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw =
      options.customWhereClause ??
      this.getFieldExpression(knex, column, options.alias);

    return this.handleFilter(
      { val: filter.value, sourceField: aiField },
      { knex, filter, column },
      options,
    );
  }

  /**
   * Sort AI Prompt LongText by the extracted `.value` text. Plain LongText
   * falls through to GenericFieldHandler's default (plain column orderBy).
   */
  override async applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options: SortOptions,
  ): Promise<void> {
    if (!isAIPromptCol(column)) {
      return super.applySort(qb, column, direction, options);
    }
    const knex = options.knex as CustomKnex;
    const field = this.getFieldExpression(knex, column, options.alias);
    qb.orderBy(
      typeof field === 'string' ? sanitize(field) : field,
      direction,
      options.nulls,
    );
  }

  async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    let value = params.value;

    if (isAIPromptCol(params.column) && ncIsObject(value)) {
      value = (value as AIRecordType).value ?? '';
    }

    value = value?.toString() ?? '';

    // if (typeof params.value !== 'string') {
    //   NcError.invalidValueForField({
    //     value: params.value,
    //     column: params.column.title,
    //     type: params.column.uidt,
    //   });
    // }
    // if (
    //   Number(params.column.dtxp) > 0 &&
    //   params.value.length > Number(params.column.dtxp)
    // ) {
    //   NcError.invalidValueForField({
    //     value: params.value,
    //     column: params.column.title,
    //     type: params.column.uidt,
    //   });
    // }
    if (value.length > NC_MAX_TEXT_LENGTH) {
      NcError._.valueLengthExceedLimit({
        length: value.length,
        column: params.column.title,
        type: params.column.uidt,
        maxLength: NC_MAX_TEXT_LENGTH,
      });
    }

    // we return a string all the time to support any input (number, boolean, etc.) on text fields
    return { value: isAIPromptCol(params.column) ? params.value : value };
  }
}
