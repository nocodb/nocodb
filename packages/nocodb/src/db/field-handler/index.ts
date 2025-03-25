import { UITypes } from 'nocodb-sdk';
import { DbClient } from './field-handler.interface';
import type { HandlerOptions } from './field-handler.interface';
import type { Knex } from 'knex';
import type { Column, Filter, Sort } from '~/models';
import type { FieldHandlerInterface } from '~/db/field-handler/field-handler.interface';
import { JsonPgHandler } from '~/db/field-handler/handlers/json/json.pg.handler';
import { JsonMssqlHandler } from '~/db/field-handler/handlers/json/json.mssql.handler';
import { JsonMysqlHandler } from '~/db/field-handler/handlers/json/json.mysql.handler';
import { JsonSqliteHandler } from '~/db/field-handler/handlers/json/json.sqlite.handler';

class FieldHandlerClass {
  private registry: Partial<
    Record<UITypes, Partial<Record<DbClient, new () => FieldHandlerInterface>>>
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
      [DbClient.PG]: JsonPgHandler,
      [DbClient.MSSQL]: JsonMssqlHandler,
      [DbClient.MYSQL]: JsonMysqlHandler,
      [DbClient.SQLITE]: JsonSqliteHandler,
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

  /**
   * Retrieves the appropriate FieldHandler instance based on UI type and database client.
   * @param uiType - The UI type of the column (e.g., UITypes.Date).
   * @param dbClient - The database client type (e.g., 'pg').
   * @returns An instance of the corresponding FieldHandler.
   * @throws Error if no handler is registered.
   */
  private getHandler(
    uiType: UITypes,
    dbClient: DbClient,
  ): FieldHandlerInterface {
    const dbHandlers = this.registry[uiType];
    if (!dbHandlers) {
      throw new Error(`No handlers registered for UIType: ${uiType}`);
    }
    const HandlerClass = dbHandlers[dbClient];
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
  applyFilter(
    qb: Knex.QueryBuilder,
    filter: Filter,
    column: Column,
    knex: Knex,
    options: HandlerOptions = {},
  ): void {
    const dbClient = knex.client.config.client as DbClient;
    const handler = this.getHandler(column.uidt, dbClient);
    handler.filter(qb, filter, column, options);
  }

  /**
   * Applies a sort to the query builder using the appropriate handler.
   * @param qb - Knex query builder instance.
   * @param sort - Sort object
   * @param column - Column object
   * @param knex - Knex instance to determine the database client.
   * @param options - Additional options like alias.
   */
  applySort(
    qb: Knex.QueryBuilder,
    sort: Sort,
    column: Column,
    knex: Knex,
    options: HandlerOptions = {},
  ): void {
    const dbClient = knex.client.config.client as DbClient;
    const handler = this.getHandler(column.uidt, dbClient);
    handler.sort(qb, sort, column, options);
  }

  /**
   * Applies a select operation to the query builder using the appropriate handler.
   * @param qb - Knex query builder instance.
   * @param column - Column object
   * @param knex - Knex instance to determine the database client.
   * @param options - Additional options like alias.
   */
  applySelect(
    qb: Knex.QueryBuilder,
    column: Column,
    knex: Knex,
    options: HandlerOptions = {},
  ): void {
    const dbClient = knex.client.config.client as DbClient;
    const handler = this.getHandler(column.uidt, dbClient);
    handler.select(qb, column, options);
  }
}

export const FieldHandler = new FieldHandlerClass();
