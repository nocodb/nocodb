import { UITypes } from 'nocodb-sdk';
import { ClientType } from 'nocodb-sdk';
import { JsonGeneralHandler } from './handlers/json/json.general.handler';
import type CustomKnex from '../CustomKnex';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import type { HandlerOptions } from './field-handler.interface';
import type { Knex } from 'knex';
import type { Column, Filter, Model } from '~/models';
import type { FieldHandlerInterface } from '~/db/field-handler/field-handler.interface';
import { JsonPgHandler } from '~/db/field-handler/handlers/json/json.pg.handler';

const CLIENT_DEFAULT = '_default';

const HANDLER_REGISTRY: Partial<
  Record<
    UITypes,
    Partial<
      Record<
        ClientType | typeof CLIENT_DEFAULT,
        new () => FieldHandlerInterface
      >
    >
  >
> = {
  [UITypes.ID]: {},
  [UITypes.LinkToAnotherRecord]: {},
  [UITypes.ForeignKey]: {},
  [UITypes.Lookup]: {},
  [UITypes.SingleLineText]: {},
  [UITypes.LongText]: {},
  [UITypes.Attachment]: {},
  [UITypes.Checkbox]: {},
  [UITypes.MultiSelect]: {},
  [UITypes.SingleSelect]: {},
  [UITypes.Date]: {},
  [UITypes.Year]: {},
  [UITypes.Time]: {},
  [UITypes.PhoneNumber]: {},
  [UITypes.GeoData]: {},
  [UITypes.Email]: {},
  [UITypes.URL]: {},
  [UITypes.Number]: {},
  [UITypes.Decimal]: {},
  [UITypes.Currency]: {},
  [UITypes.Percent]: {},
  [UITypes.Duration]: {},
  [UITypes.Rating]: {},
  [UITypes.Formula]: {},
  [UITypes.Rollup]: {},
  [UITypes.DateTime]: {},
  [UITypes.CreatedTime]: {},
  [UITypes.LastModifiedTime]: {},
  [UITypes.AutoNumber]: {},
  [UITypes.Geometry]: {},
  [UITypes.JSON]: {
    [ClientType.PG]: JsonPgHandler,
    [CLIENT_DEFAULT]: JsonGeneralHandler,
  },
  [UITypes.SpecificDBType]: {},
  [UITypes.Barcode]: {},
  [UITypes.QrCode]: {},
  [UITypes.Button]: {},
  [UITypes.Links]: {},
  [UITypes.User]: {},
  [UITypes.CreatedBy]: {},
  [UITypes.LastModifiedBy]: {},
};

function getLogicalOpMethod(logical_op?: string) {
  switch (logical_op?.toLowerCase()) {
    case 'or':
      return 'orWhere';
    case 'and':
      return 'andWhere';
    case 'not':
      return 'whereNot';
    default:
      return 'where';
  }
}
export class FieldHandler {
  constructor(
    public readonly info: {
      model: Model;
      knex: CustomKnex;
      context: NcContext;
    },
  ) {}

  static fromBaseModel(baseModel: IBaseModelSqlV2) {
    return new FieldHandler({
      context: baseModel.context,
      model: baseModel.model,
      knex: baseModel.dbDriver,
    });
  }

  /**
   * Retrieves the appropriate FieldHandler instance based on UI type and database client.
   * @param uiType - The UI type of the column (e.g., UITypes.Date).
   * @param dbClient - The database client type (e.g., 'pg').
   * @returns An instance of the corresponding FieldHandler.
   * @throws Error if no handler is registered.
   */
  private getHandler(
    uiType: UITypes,
    dbClient: ClientType,
  ): FieldHandlerInterface {
    const dbHandlers = HANDLER_REGISTRY[uiType];
    const HandlerClass = dbHandlers?.[dbClient] ?? dbHandlers?.[CLIENT_DEFAULT];
    if (!HandlerClass) {
      throw new Error(
        `No handler registered for UIType: ${uiType} and DB client: ${dbClient}`,
      );
    }
    return new HandlerClass();
  }

  /**
   * Applies a filter to the query builder using the appropriate handler.
   * @param qb - Knex query builder instance.
   * @param filter - Filter object
   * @param column - Column object
   * @param knex - Knex instance to determine the database client.
   * @param options - Additional options like alias.
   */
  async applyFilter(
    filter: Filter,
    column?: Column,
    options: HandlerOptions = {},
  ): Promise<(qb: Knex.QueryBuilder) => void> {
    const knex = options.knex ?? this.info.knex;
    const dbClient = knex.client.config.client as ClientType;
    const handler = this.getHandler(column.uidt, dbClient);
    const useColumn =
      column ?? this.info.model.columns.find((col) => col.id === filter.id);
    return handler.filter(knex, filter, useColumn, {
      knex,
      context: this.info.context,
      model: this.info.model,
      ...options,
    });
  }

  async applyFilterGroup(filter: Filter, options: HandlerOptions = {}) {
    return this.applyFilters(filter.children, options);
  }

  async applyFilters(
    filters: Filter[],
    options: HandlerOptions = {},
  ): Promise<(qb: Knex.QueryBuilder) => void> {
    const model = options.model ?? this.info.model;
    const qbHandlers: {
      handler: (qb: Knex.QueryBuilder) => void;
      index: number;
      logicalOps?: string;
    }[] = [];
    let index = 0;
    for (const filter of filters) {
      if (filter.is_group) {
        qbHandlers.push({
          handler: await this.applyFilterGroup(filter, options),
          index: index++,
          logicalOps: filter.logical_op,
        });
      } else {
        const column = model.columns.find((col) => col.id === filter.id);
        qbHandlers.push({
          handler: await this.applyFilter(filter, column, options),
          index: index++,
          logicalOps: filter.logical_op,
        });
      }
    }
    return (qb: Knex.QueryBuilder) => {
      for (const handler of qbHandlers.sort((a, b) => a.index - b.index)) {
        qb[getLogicalOpMethod(handler.logicalOps)](qb);
      }
    };
  }

  /**
   * Applies a select operation to the query builder using the appropriate handler.
   * @param qb - Knex query builder instance.
   * @param column - Column object
   * @param knex - Knex instance to determine the database client.
   * @param options - Additional options like alias.
   */
  async applySelect(
    qb: Knex.QueryBuilder,
    column: Column,
    options: HandlerOptions = {},
  ): Promise<void> {
    const knex = options.knex ?? this.info.knex;
    const dbClient = knex.client as ClientType;
    const handler = this.getHandler(column.uidt, dbClient);
    return handler.select(qb, column, {
      knex,
      context: this.info.context,
      model: this.info.model,
      ...options,
    });
  }
}
