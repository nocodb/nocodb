import { UITypes } from 'nocodb-sdk';
import { ClientType } from 'nocodb-sdk';
import { JsonGeneralHandler } from './handlers/json/json.general.handler';
import { GenericFieldHandler } from './handlers/generic';
import { CheckboxGeneralHandler } from './handlers/checkbox/checkbox.general.handler';
import { DateTimeGeneralHandler } from './handlers/date-time/date-time.general.handler';
import { DateGeneralHandler } from './handlers/date/date.general.handler';
import { MultiSelectGeneralHandler } from './handlers/multi-select/multi-select.general.handler';
import { SingleSelectGeneralHandler } from './handlers/single-select/single-select.general.handler';
import { DecimalGeneralHandler } from './handlers/decimal/decimal.general.handler';
import { NumberGeneralHandler } from './handlers/number/number.general.handler';
import { FilterVerificationError } from './error/filter-verification.error';
import { FormulaGeneralHandler } from './handlers/formula/formula.general.handler';
import type CustomKnex from '../CustomKnex';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import type {
  FilterVerificationResult,
  HandlerOptions,
  IFieldHandler,
} from './field-handler.interface';
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
  [UITypes.SingleLineText]: {
    [CLIENT_DEFAULT]: GenericFieldHandler,
  },
  [UITypes.LongText]: {
    [CLIENT_DEFAULT]: GenericFieldHandler,
  },
  [UITypes.Attachment]: {},
  [UITypes.Checkbox]: {
    [CLIENT_DEFAULT]: CheckboxGeneralHandler,
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
  [UITypes.Year]: {},
  [UITypes.Time]: {},
  [UITypes.PhoneNumber]: {
    [CLIENT_DEFAULT]: GenericFieldHandler,
  },
  [UITypes.GeoData]: {},
  [UITypes.Email]: {
    [CLIENT_DEFAULT]: GenericFieldHandler,
  },
  [UITypes.URL]: {
    [CLIENT_DEFAULT]: GenericFieldHandler,
  },
  [UITypes.Number]: {
    [CLIENT_DEFAULT]: NumberGeneralHandler,
  },
  [UITypes.Decimal]: {
    [CLIENT_DEFAULT]: DecimalGeneralHandler,
  },
  [UITypes.Currency]: {
    [CLIENT_DEFAULT]: DecimalGeneralHandler,
  },
  [UITypes.Percent]: {
    [CLIENT_DEFAULT]: DecimalGeneralHandler,
  },
  [UITypes.Duration]: {},
  [UITypes.Rating]: {},
  [UITypes.Formula]: {
    [CLIENT_DEFAULT]: FormulaGeneralHandler,
  },
  [UITypes.Rollup]: {},
  [UITypes.DateTime]: {
    [CLIENT_DEFAULT]: DateTimeGeneralHandler,
  },
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
export class FieldHandler implements IFieldHandler {
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
      fieldHandler: this,
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
    if (!model.columns) {
      await model.getColumns(options.context ?? this.info.context);
    }
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
        const column = model.columns.find(
          (col) => col.id === filter.fk_column_id,
        );
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
      fieldHandler: this,
      ...options,
    });
  }

  async verifyFilter(
    filter: Filter,
    column: Column,
    options: HandlerOptions = {},
  ) {
    const knex = options.knex ?? this.info.knex;
    return (
      this.getHandler(column.uidt, knex.client) ?? new GenericFieldHandler()
    ).verifyFilter(filter, column, {
      fieldHandler: this,
      ...options,
    });
  }

  async verifyFiltersSafe(filters: Filter[], options: HandlerOptions = {}) {
    const model = options.model ?? this.info.model;
    if (!model.columns) {
      await model.getColumns(options.context ?? this.info.context);
    }
    const traverseResult: FilterVerificationResult[] = [];
    await this.traverseFilters(filters, async (filter: Filter) => {
      const column = model.columns.find(
        (col) => col.id === filter.fk_column_id,
      );
      traverseResult.push(await this.verifyFilter(filter, column, options));
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

  async verifyFilters(filters: Filter[], options: HandlerOptions = {}) {
    const verificationResult = await this.verifyFiltersSafe(filters, options);
    if (!verificationResult.isValid) {
      throw new FilterVerificationError(verificationResult.errors!);
    }
    return true;
  }

  async traverseFilters(
    filters: Filter[],
    handler: <T>(filter: Filter) => Promise<void | T>,
  ) {
    return Promise.all(
      (filters ?? []).map(async (filter) => {
        if (filter.is_group) {
          return this.traverseFilters(filter.children, handler);
        } else {
          return handler(filter);
        }
      }),
    );
  }
}
