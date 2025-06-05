import {
  isLinksOrLTAR,
  isLookup,
  isRollup,
  NcApiVersion,
  ncIsUndefined,
  UITypes,
} from 'nocodb-sdk';
import { ClientType } from 'nocodb-sdk';
import { FilterVerificationError } from './error/filter-verification.error';
import type { Logger } from '@nestjs/common';
import type { MetaService } from '~/meta/meta.service';
import type CustomKnex from '../CustomKnex';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import type {
  FilterOperationResult,
  FilterOptions,
  FilterVerificationResult,
  IFieldHandler,
} from './field-handler.interface';
import type { Knex } from 'knex';
import type { Filter } from '~/models';
import type { FieldHandlerInterface } from '~/db/field-handler/field-handler.interface';
import { NcError } from '~/helpers/catchError';
import { JsonGeneralHandler } from '~/db/field-handler/handlers/json/json.general.handler';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { CheckboxGeneralHandler } from '~/db/field-handler/handlers/checkbox/checkbox.general.handler';
import { DateTimeGeneralHandler } from '~/db/field-handler/handlers/date-time/date-time.general.handler';
import { DateGeneralHandler } from '~/db/field-handler/handlers/date/date.general.handler';
import { MultiSelectGeneralHandler } from '~/db/field-handler/handlers/multi-select/multi-select.general.handler';
import { SingleSelectGeneralHandler } from '~/db/field-handler/handlers/single-select/single-select.general.handler';
import { DecimalGeneralHandler } from '~/db/field-handler/handlers/decimal/decimal.general.handler';
import { NumberGeneralHandler } from '~/db/field-handler/handlers/number/number.general.handler';
import { FormulaGeneralHandler } from '~/db/field-handler/handlers/formula/formula.general.handler';
import { JsonMySqlHandler } from '~/db/field-handler/handlers/json/json.mysql.handler';
import { LtarGeneralHandler } from '~/db/field-handler/handlers/ltar/ltar.general.handler';
import { LookupGeneralHandler } from '~/db/field-handler/handlers/lookup/lookup.general.handler';
import { LinksGeneralHandler } from '~/db/field-handler/handlers/links/links.general.handler';
import { RollupGeneralHandler } from '~/db/field-handler/handlers/rollup/rollup.general.handler';
import { PercentGeneralHandler } from '~/db/field-handler/handlers/percent/percent.general.handler';
import { RatingGeneralHandler } from '~/db/field-handler/handlers/rating/rating.general.handler';
import { YearGeneralHandler } from '~/db/field-handler/handlers/year/year.general.handler';
import { UserGeneralHandler } from '~/db/field-handler/handlers/user/user.general.handler';
import { DurationGeneralHandler } from '~/db/field-handler/handlers/duration/duration.general.handler';
import { CheckboxSqliteHandler } from '~/db/field-handler/handlers/checkbox/checkbox.sqlite.handler';
import { LongTextGeneralHandler } from '~/db/field-handler/handlers/long-text/long-text.general.handler';
import { SingleLineTextGeneralHandler } from '~/db/field-handler/handlers/single-line-text/single-line-text.general.handler';
import { ComputedFieldHandler } from '~/db/field-handler/handlers/computed';
import { DateTimeMsSQLHandler } from '~/db/field-handler/handlers/date-time/date-time.mssql.handler';
import { DateTimeSQLiteHandler } from '~/db/field-handler/handlers/date-time/date-time.sqlite.handler';
import { DateTimeMySQLHandler } from '~/db/field-handler/handlers/date-time/date-time.mysql.handler';
import { DateTimePGHandler } from '~/db/field-handler/handlers/date-time/date-time.pg.handler';
import { DecimalMysqlHandler } from '~/db/field-handler/handlers/decimal/decimal.mysql.handler';
import { DecimalSqliteHandler } from '~/db/field-handler/handlers/decimal/decimal.sqlite.handler';
import { NumberPgHandler } from '~/db/field-handler/handlers/number/number.pg.handler';
import { NumberMysqlHandler } from '~/db/field-handler/handlers/number/number.mysql.handler';
import { NumberSqliteHandler } from '~/db/field-handler/handlers/number/number.sqlite.handler';
import { RatingMysqlHandler } from '~/db/field-handler/handlers/rating/rating.mysql.handler';
import { RatingPgHandler } from '~/db/field-handler/handlers/rating/rating.pg.handler';
import { RatingSqliteHandler } from '~/db/field-handler/handlers/rating/rating.sqlite.handler';
import { PercentMysqlHandler } from '~/db/field-handler/handlers/percent/percent.mysql.handler';
import { PercentPgHandler } from '~/db/field-handler/handlers/percent/percent.pg.handler';
import { PercentSqliteHandler } from '~/db/field-handler/handlers/percent/percent.sqlite.handler';
import { UserPgHandler } from '~/db/field-handler/handlers/user/user.pg.handler';
import { UserSqliteHandler } from '~/db/field-handler/handlers/user/user.sqlite.handler';
import { PhoneNumberGeneralHandler } from '~/db/field-handler/handlers/phone-number/phone-number.general.handler';
import { Column } from '~/models';
import { JsonPgHandler } from '~/db/field-handler/handlers/json/json.pg.handler';
import { DecimalPgHandler } from '~/db/field-handler/handlers/decimal/decimal.pg.handler';
import { EmailGeneralHandler } from '~/db/field-handler/handlers/email/email.general.handler';

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
  [UITypes.ID]: {
    [CLIENT_DEFAULT]: GenericFieldHandler,
  },
  [UITypes.LinkToAnotherRecord]: {
    [CLIENT_DEFAULT]: LtarGeneralHandler,
  },
  [UITypes.ForeignKey]: {},
  [UITypes.Lookup]: {
    [CLIENT_DEFAULT]: LookupGeneralHandler,
  },
  [UITypes.SingleLineText]: {
    [CLIENT_DEFAULT]: SingleLineTextGeneralHandler,
  },
  [UITypes.LongText]: {
    [CLIENT_DEFAULT]: LongTextGeneralHandler,
  },
  [UITypes.Attachment]: {},
  [UITypes.Checkbox]: {
    [CLIENT_DEFAULT]: CheckboxGeneralHandler,
    [ClientType.SQLITE]: CheckboxSqliteHandler,
  },
  [UITypes.MultiSelect]: {
    [CLIENT_DEFAULT]: MultiSelectGeneralHandler,
  },
  [UITypes.SingleSelect]: {
    [CLIENT_DEFAULT]: SingleSelectGeneralHandler,
  },
  [UITypes.Date]: {
    [CLIENT_DEFAULT]: DateGeneralHandler,
  },
  [UITypes.Year]: {
    [CLIENT_DEFAULT]: YearGeneralHandler,
  },
  [UITypes.Time]: {},
  [UITypes.PhoneNumber]: {
    [CLIENT_DEFAULT]: PhoneNumberGeneralHandler,
  },
  [UITypes.GeoData]: {},
  [UITypes.Email]: {
    [CLIENT_DEFAULT]: EmailGeneralHandler,
  },
  [UITypes.URL]: {
    [CLIENT_DEFAULT]: GenericFieldHandler,
  },
  [UITypes.Number]: {
    [CLIENT_DEFAULT]: NumberGeneralHandler,
    [ClientType.PG]: NumberPgHandler,
    [ClientType.MYSQL]: NumberMysqlHandler,
    [ClientType.SQLITE]: NumberSqliteHandler,
  },
  [UITypes.Decimal]: {
    [CLIENT_DEFAULT]: DecimalGeneralHandler,
    [ClientType.PG]: DecimalPgHandler,
    [ClientType.MYSQL]: DecimalMysqlHandler,
    [ClientType.SQLITE]: DecimalSqliteHandler,
  },
  [UITypes.Currency]: {
    [CLIENT_DEFAULT]: DecimalGeneralHandler,
  },
  [UITypes.Percent]: {
    [CLIENT_DEFAULT]: PercentGeneralHandler,
    [ClientType.PG]: PercentMysqlHandler,
    [ClientType.MYSQL]: PercentPgHandler,
    [ClientType.SQLITE]: PercentSqliteHandler,
  },
  [UITypes.Duration]: {
    [CLIENT_DEFAULT]: DurationGeneralHandler,
  },
  [UITypes.Rating]: {
    [CLIENT_DEFAULT]: RatingGeneralHandler,
    [ClientType.PG]: RatingMysqlHandler,
    [ClientType.MYSQL]: RatingPgHandler,
    [ClientType.SQLITE]: RatingSqliteHandler,
  },
  [UITypes.Formula]: {
    [CLIENT_DEFAULT]: FormulaGeneralHandler,
  },
  [UITypes.Rollup]: {
    [CLIENT_DEFAULT]: RollupGeneralHandler,
  },
  [UITypes.DateTime]: {
    [CLIENT_DEFAULT]: DateTimeGeneralHandler,
    [ClientType.PG]: DateTimePGHandler,
    [ClientType.MYSQL]: DateTimeMySQLHandler,
    [ClientType.SQLITE]: DateTimeSQLiteHandler,
    [ClientType.MSSQL]: DateTimeMsSQLHandler,
  },
  [UITypes.CreatedTime]: {
    [CLIENT_DEFAULT]: ComputedFieldHandler,
  },
  [UITypes.LastModifiedTime]: {
    [CLIENT_DEFAULT]: ComputedFieldHandler,
  },
  [UITypes.AutoNumber]: {},
  [UITypes.Geometry]: {},
  [UITypes.JSON]: {
    [ClientType.PG]: JsonPgHandler,
    [ClientType.MYSQL]: JsonMySqlHandler,
    [CLIENT_DEFAULT]: JsonGeneralHandler,
  },
  [UITypes.SpecificDBType]: {},
  [UITypes.Barcode]: {
    [CLIENT_DEFAULT]: ComputedFieldHandler,
  },
  [UITypes.QrCode]: {
    [CLIENT_DEFAULT]: ComputedFieldHandler,
  },
  [UITypes.Button]: {
    [CLIENT_DEFAULT]: ComputedFieldHandler,
  },
  [UITypes.Links]: {
    [CLIENT_DEFAULT]: LinksGeneralHandler,
  },
  [UITypes.User]: {
    [CLIENT_DEFAULT]: UserGeneralHandler,
    [ClientType.PG]: UserPgHandler,
    [ClientType.SQLITE]: UserSqliteHandler,
  },
  [UITypes.CreatedBy]: {
    [CLIENT_DEFAULT]: ComputedFieldHandler,
  },
  [UITypes.LastModifiedBy]: {
    [CLIENT_DEFAULT]: ComputedFieldHandler,
  },
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
export class FieldHandler implements IFieldHandler {
  constructor(
    public readonly info: {
      baseModel: IBaseModelSqlV2;
      knex: CustomKnex;
      context: NcContext;
    },
  ) {}

  static fromBaseModel(baseModel: IBaseModelSqlV2) {
    return new FieldHandler({
      context: baseModel.context,
      baseModel: baseModel,
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
      return undefined;
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
    options: FilterOptions = {},
  ) {
    const knex = options.knex ?? this.info.knex;
    const dbClient = (knex.clientType?.() ??
      knex.client.config.client) as ClientType;
    const handler = this.getHandler(column.uidt, dbClient);
    const useColumn =
      column ??
      this.info.baseModel.model.columns.find((col) => col.id === filter.id);
    return handler.filter(knex, filter, useColumn, {
      knex,
      fieldHandler: this,
      ...this.info,
      ...options,
    });
  }

  async applyFilterGroup(filter: Filter, options: FilterOptions = {}) {
    return this.applyFilters(filter.children, options);
  }

  async applyFilters(filters: Filter[], options: FilterOptions = {}) {
    const model = options.baseModel?.model ?? this.info.baseModel.model;
    if (!model.columns) {
      await model.getColumns(options.context ?? this.info.context);
    }
    const qbHandlers: {
      handler: FilterOperationResult;
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
        let column = model.columns.find(
          (col) => col.id === filter.fk_column_id,
        );
        if (!column) {
          column = await this.getRelatedColumnById(
            options.context,
            filter.fk_column_id,
          );
        }
        qbHandlers.push({
          handler: await this.applyFilter(filter, column, options),
          index: index++,
          logicalOps: filter.logical_op,
        });
      }
    }
    return {
      clause: (qb: Knex.QueryBuilder) => {
        for (const handler of qbHandlers.sort((a, b) => a.index - b.index)) {
          qb[getLogicalOpMethod(handler.logicalOps)](handler.handler.clause);
        }
      },
      rootApply: (qb: Knex.QueryBuilder) => {
        for (const handler of qbHandlers.sort((a, b) => a.index - b.index)) {
          handler.handler.rootApply?.(qb);
        }
      },
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
    options: FilterOptions = {},
  ): Promise<void> {
    const knex = options.knex ?? this.info.knex;
    const dbClient = (knex.clientType?.() ??
      knex.client.config.client) as ClientType;
    const handler = this.getHandler(column.uidt, dbClient);
    return handler.select(qb, column, {
      knex,
      fieldHandler: this,
      ...this.info,
      ...options,
    });
  }

  async verifyFilter(
    filter: Filter,
    column: Column,
    options: FilterOptions = {},
  ) {
    const knex = options.knex ?? this.info.knex;
    return (
      this.getHandler(column.uidt, knex.client) ?? new GenericFieldHandler()
    ).verifyFilter(filter, column, {
      fieldHandler: this,
      ...this.info,
      ...options,
    });
  }

  async verifyFiltersSafe(filters: Filter[], options: FilterOptions = {}) {
    const baseModel = options.baseModel ?? this.info.baseModel;
    const context = options.context ?? this.info.context;
    const model = baseModel.model;
    if (!model.columns) {
      await model.getColumns(context);
    }
    const traverseResult: FilterVerificationResult[] = [];
    await this.traverseFilters(filters, async (filter: Filter) => {
      let column = model.columns.find((col) => col.id === filter.fk_column_id);
      if (!column) {
        column = await this.getRelatedColumnById(context, filter.fk_column_id);
      }
      traverseResult.push(
        await this.verifyFilter(filter, column, {
          ...this.info,
          ...options,
        }),
      );
    });
    const invalidFilterResults = traverseResult
      .filter((k) => !k.isValid)
      .reduce(
        (obj, res) => {
          obj.errors = obj.errors.concat(res.errors);
          return obj;
        },
        { isValid: false, errors: [] } as FilterVerificationResult,
      );
    if (invalidFilterResults.errors?.length > 0) {
      return invalidFilterResults;
    } else {
      return { isValid: true } as FilterVerificationResult;
    }
  }

  async verifyFilters(filters: Filter[], options: FilterOptions = {}) {
    const verificationResult = await this.verifyFiltersSafe(filters, options);
    if (!verificationResult.isValid) {
      if (this.info.context.api_version === NcApiVersion.V3) {
        NcError.invalidFilterV3(verificationResult.errors.join(', '));
      } else {
        throw new FilterVerificationError(verificationResult.errors!);
      }
    }
    return true;
  }

  async traverseFilters(
    filters: Filter[],
    handler: <T>(filter: Filter) => Promise<void | T>,
  ) {
    return Promise.all(
      (filters ?? []).map(async (filter) => {
        // somehow filters is an array of array
        if (Array.isArray(filter)) {
          return this.traverseFilters(filter, handler);
        } else if (filter.is_group) {
          return this.traverseFilters(filter.children, handler);
        } else {
          return handler(filter);
        }
      }),
    );
  }

  async getRelatedColumnById(context: NcContext, colId: string) {
    // possibly to be enhanced into getting the model and basemodel too
    const column = await Column.get(context, { colId });
    return column;
  }

  async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
      baseModel?: IBaseModelSqlV2;
    };
  }): Promise<{ value: any }> {
    const baseModel = params.options?.baseModel ?? this.info.baseModel;
    const knex = baseModel.dbDriver;
    const dbClientType = (knex.clientType?.() ??
      knex.client.config.client) as ClientType;

    const handler = this.getHandler(params.column.uidt, dbClientType);
    if (handler) {
      return handler.parseUserInput({
        ...params,
        options: {
          baseModel: this.info.baseModel,
          ...params.options,
        },
      });
    } else {
      return { value: params.value };
    }
  }

  async parseDbValue(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
    };
    // for now the return value need to be {value: any}
    // since it's possible for it to be knex query, which
    // can be executed when awaited
  }): Promise<{ value: any }> {
    const baseModel = params.options?.baseModel ?? this.info.baseModel;
    const knex = baseModel.dbDriver;
    const dbClientType = (knex.clientType?.() ??
      knex.client.config.client) as ClientType;

    const handler = this.getHandler(params.column.uidt, dbClientType);
    if (handler) {
      return handler.parseDbValue({
        ...params,
        options: {
          baseModel: this.info.baseModel,
          ...params.options,
        },
      });
    } else {
      return { value: params.value };
    }
  }

  async parseDataDbValue(params: {
    data: any | any[];
    options?: {
      additionalColumns?: Column[];
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
    };
    // for now the return value need to be {value: any}
    // since it's possible for it to be knex query, which
    // can be executed when awaited
  }): Promise<void> {
    const baseModel = params.options?.baseModel ?? this.info.baseModel;
    const context =
      params.options?.context ?? this.info.context ?? baseModel.context;
    const knex = baseModel.dbDriver;
    const dbClientType = (knex.clientType?.() ??
      knex.client.config.client) as ClientType;
    const data = Array.isArray(params.data) ? params.data : [params.data];
    for (const column of (await baseModel.model.getColumns(context)).concat(
      params.options?.additionalColumns || [],
    )) {
      const handler = this.getHandler(column.uidt, dbClientType);
      if (handler) {
        for (const row of data) {
          if (!ncIsUndefined(row[column.id])) {
            row[column.id] = (
              await handler.parseDbValue({
                value: row[column.id],
                row,
                column,
                options: {
                  baseModel: this.info.baseModel,
                  ...params.options,
                  fieldHandler: this,
                },
              })
            ).value;
          }
          if (!ncIsUndefined(row[column.title])) {
            row[column.title] = (
              await handler.parseDbValue({
                value: row[column.title],
                row,
                column,
                options: {
                  baseModel: this.info.baseModel,
                  ...params.options,
                  fieldHandler: this,
                },
              })
            ).value;
          } else if (
            isLookup(column) ||
            isLinksOrLTAR(column) ||
            isRollup(column)
          ) {
            // const value = (
            //   await handler.parseDbValue({
            //     value: row[column.title],
            //     row,
            //     baseModel: baseModel,
            //     column,
            //     options: { ...params.options, fieldHandler: this },
            //   })
            // ).value;
            // row[column.title] = value;
            // row[column.id] = value;
          }
        }
      } else {
        continue;
      }
    }
  }
}
