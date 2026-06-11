import { arrFlatMap, ClientType } from 'nocodb-sdk';
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
   * Dialect-specific aggregation SQL generator.
   * Each subclass forwards to its own
   * `gen{Pg,Mysql2,Sqlite3,Mssql}AggregateQuery`.
   */
  abstract generateAggregateQuery(
    params: AggregationGeneratorParams,
  ): string | undefined;

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
