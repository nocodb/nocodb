import { NcError } from 'src/helpers/catchError';
import { NC_MAX_TEXT_LENGTH } from 'src/constants';
import { isAIPromptCol, ncIsObject } from 'nocodb-sdk';
import type { AIRecordType, NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column, Filter } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class LongTextGeneralHandler extends GenericFieldHandler {
  /**
   * AI Prompt columns store an `{ value, prompt, ... }` object as JSON text.
   * Filter operators target the inner `.value` string — rewrite the source
   * field expression to dialect-specific JSON extraction before delegating
   * to the standard handleFilter pipeline. Non-AI-prompt LongText columns
   * use the generic text behavior unchanged.
   *
   * MySQL preserves case-sensitive comparison via LongTextMysqlHandler's
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

    const { alias } = options;
    const baseField =
      options.customWhereClause ??
      (alias ? `${alias}.${column.column_name}` : column.column_name);

    const client = knex.clientType();
    let aiField: any = baseField;
    if (client === 'pg') {
      aiField = knex.raw(`TRIM('"' FROM (??::jsonb->>'value'))`, [
        column.column_name,
      ]);
    } else if (client.startsWith('mysql')) {
      aiField = knex.raw(`JSON_UNQUOTE(JSON_EXTRACT(??, '$.value'))`, [
        column.column_name,
      ]);
    } else if (client === 'sqlite3') {
      aiField = knex.raw(`json_extract(??, '$.value')`, [column.column_name]);
    } else if (client === 'mssql') {
      // T-SQL: JSON_VALUE returns scalar text from a path; matches the
      // unquoted, untyped extraction the other dialects produce.
      aiField = knex.raw(`JSON_VALUE(??, '$.value')`, [column.column_name]);
    }

    return this.handleFilter(
      { val: filter.value, sourceField: aiField },
      { knex, filter, column },
      options,
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
