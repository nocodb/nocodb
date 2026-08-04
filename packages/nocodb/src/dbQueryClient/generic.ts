import {
  arrFlatMap,
  ClientType,
  ncIsArray,
  ncIsBoolean,
  ncIsNull,
  ncIsObject,
  ncIsUndefined,
} from 'nocodb-sdk';
import type {
  AggregateCtx,
  AggregationGeneratorParams,
  BulkAggregateCtx,
  DBQueryClient,
} from '~/dbQueryClient/types';
import type { NcContext } from '~/interface/config';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex, XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Model } from '~/models';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import { aggregate as aggregateOrchestration } from '~/dbQueryClient/cross-db-utils/aggregate';
import { bulkAggregate as bulkAggregateOrchestration } from '~/dbQueryClient/cross-db-utils/bulk-aggregate';
import { getAggregationHandler } from '~/dbQueryClient/aggregations';

export abstract class GenericDBQueryClient implements DBQueryClient {
  dbVersion?: string;

  get clientType(): ClientType {
    return ClientType.PG;
  }
  validateClientType(client: string) {
    if (client !== this.clientType) {
      throw new Error('Source is not ' + this.clientType);
    }
  }
  temporaryTableRaw({
    knex,
    data,
    fields,
    alias,
  }: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  }) {
    const fieldsValuePlaceholder = `(${fields.map(() => '?').join(',')})`;
    const valuesPlaceholder = data.map(() => fieldsValuePlaceholder).join(', ');
    const fieldsPlaceholder = fields.map(() => '??').join(',');
    return knex.raw(
      `(VALUES ${valuesPlaceholder}) AS ?? (${fieldsPlaceholder})`,
      [
        ...arrFlatMap(
          data.map((row) =>
            fields.reduce((acc, field) => {
              acc.push(row[field]);
              return acc;
            }, []),
          ),
        ),
        alias,
        ...fields,
      ],
    );
  }
  temporaryTable(param: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
    asKnexFrom?: boolean;
  }) {
    return param.knex.from(this.temporaryTableRaw(param));
  }

  tableAlias(knex: XKnex, table: string | Knex.Raw, alias: string): Knex.Raw {
    return knex.raw(`?? as ??`, [table, alias]);
  }

  /**
   * Bulk update by primary key via per-column CASE statements — one
   * statement for the whole batch (pg / mysql / sqlite / mssql):
   *
   *   UPDATE table SET
   *     col1 = CASE id WHEN 1 THEN 'val1' WHEN 2 THEN 'val2' ELSE col1 END,
   *     col2 = CASE id WHEN 1 THEN 'val3' WHEN 2 THEN 'val4' ELSE col2 END
   *   WHERE id IN (1, 2)
   *
   * Oracle overrides this — its CASE types from the first THEN clause and
   * rejects the differently-typed ELSE column reference (ORA-00932).
   */
  batchUpdate({
    knex,
    tnPath,
    rows,
    pkColumnName,
  }: {
    knex: XKnex;
    tnPath: string | Knex.Raw;
    rows: Record<string, any>[];
    pkColumnName: string;
  }): Knex.QueryBuilder | Knex.Raw | null {
    if (!rows.length) return null;

    // Rows missing the primary key can't be targeted by the CASE/WHEN — and
    // on MSSQL knex's binding-validation pass rejects the resulting
    // `undefined` outright ("Undefined binding(s) detected for keys [1] when
    // compiling RAW query: CASE [id] WHEN ? THEN ?"). Drop them up front so
    // every row we go on to bind has both a pk and at least one
    // non-undefined column.
    const rowsWithPk = rows.filter((row) => !ncIsUndefined(row[pkColumnName]));
    if (!rowsWithPk.length) return null;

    const pks = [...new Set(rowsWithPk.map((row) => row[pkColumnName]))];

    // Get all columns except primary key that need to be updated
    const allColumns = new Set<string>();
    rowsWithPk.forEach((row) => {
      Object.keys(row).forEach((col) => {
        if (col !== pkColumnName) allColumns.add(col);
      });
    });

    // return null if no fields updated
    if (allColumns.size === 0) {
      return null;
    }

    const columns = Array.from(allColumns);

    // Build update object with CASE statements for each column
    const updateObj: Record<string, Knex.Raw> = {};

    columns.forEach((column) => {
      const filteredRows = rowsWithPk.filter(
        (row) => !ncIsUndefined(row[column]),
      );
      if (!filteredRows.length) return;
      updateObj[column] = knex.raw(
        `CASE ?? ${filteredRows
          .map(() => 'WHEN ? THEN ?')
          .join(' ')} ELSE ?? END`,
        [
          pkColumnName,
          ...filteredRows.flatMap((row) => [
            row[pkColumnName],

            ncIsNull(row[column]) ||
            ncIsObject(row[column]) ||
            ncIsArray(row[column]) ||
            ncIsBoolean(row[column])
              ? row[column]
              : `${row[column]}`,
          ]),
          column,
        ],
      );
    });

    // Build and return the query
    if (Object.keys(updateObj).length === 0) return null;
    return knex(tnPath).update(updateObj).whereIn(pkColumnName, pks);
  }

  abstract concat(fields: string[]): string;
  abstract simpleCast(field: string, asType: string): string;

  generateNestedRowSelectQuery(_param: any): Knex.Raw<any> {
    throw new Error('Not implemented');
  }
  async singleQueryList(
    _context: any,
    _ctx: any,
  ): Promise<
    PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
  > {
    throw new Error('Not implemented');
  }
  async singleQueryRead(
    _context: any,
    _ctx: any,
  ): Promise<Record<string, any>> {
    throw new Error('Not implemented');
  }

  async extractColumns(_param: any): Promise<void> {
    throw new Error('Not implemented');
  }

  async extractColumn(_param: any): Promise<{
    isArray?: boolean;
  }> {
    throw new Error('Not implemented');
  }

  replaceDelimitedWithKeyValue(_params: {
    knex: CustomKnex;
    stack: { key: string; value: string }[];
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder;
    delimiter?: string;
  }): string {
    throw new Error('Not implemented');
  }
  /**
   * Dialect-specific aggregation SQL generator. Resolves the per-dialect
   * aggregation strategy from the registry (see
   * `~/dbQueryClient/aggregations`) — the aggregation analogue of the
   * `field-handler` dispatch. Subclasses no longer override this; instead each
   * dialect ships an `AggregationHandler` class.
   */
  generateAggregateQuery(
    params: AggregationGeneratorParams,
  ): string | undefined {
    return getAggregationHandler(this.clientType).generate(params);
  }

  aggregate(
    context: NcContext,
    ctx: AggregateCtx,
  ): Promise<Record<string, unknown>> {
    return aggregateOrchestration(this)(context, ctx);
  }

  bulkAggregate(
    context: NcContext,
    ctx: BulkAggregateCtx,
  ): Promise<Record<string, Record<string, unknown>>> {
    return bulkAggregateOrchestration(this)(context, ctx);
  }

  abstract bulkAggregateRowSelector(
    baseModel: IBaseModelSqlV2,
    tQb: Knex.QueryBuilder,
    expressions: Record<string, string>,
    alias: string,
  ): Knex.Raw;

  /**
   * pg/mysql/sqlite — `LIMIT/OFFSET` runs without ORDER BY, so nothing
   * to do. Mssql overrides this to satisfy T-SQL's OFFSET/FETCH rule.
   */
  ensurePaginationOrderBy(_qb: Knex.QueryBuilder, _model: Model): void {
    // no-op
  }
}
