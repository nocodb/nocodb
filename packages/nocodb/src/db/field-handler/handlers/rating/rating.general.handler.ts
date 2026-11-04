import { type NcContext, parseProp } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import { DecimalGeneralHandler } from '../decimal/decimal.general.handler';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column, Filter } from 'src/models';
import type CustomKnex from 'src/db/CustomKnex';
import type { FilterOptions } from '../../field-handler.interface';

export class RatingGeneralHandler extends DecimalGeneralHandler {
  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    const value = (await super.parseUserInput(params))?.value;
    if (typeof value === 'number') {
      const max = parseFloat(parseProp(params.column.meta)?.max);
      if (value < 0 || value > max) {
        NcError.invalidValueForField({
          value: value.toString(),
          column: params.column.title,
          type: params.column.uidt,
        });
      }
    }
    return { value };
  }

  override async filterLt(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    _rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(sourceField as any, '<', val);
        if (val > 0) {
          qb.orWhereNull(sourceField as any);
        }
      },
    };
  }

  override async filterLte(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    _rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(sourceField as any, '<=', val);
        if (val >= 0) {
          qb.orWhereNull(sourceField as any);
        }
      },
    };
  }

  override async filterGte(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    _rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const { val, sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(sourceField as any, '>=', val);
        if (val <= 0) {
          qb.orWhereNull(sourceField as any);
        }
      },
    };
  }

  // The column defaults to 0 and clearing a star writes 0, so 0 is unrated.
  override async filterBlank(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter & { groupby?: boolean };
      column: Column;
    },
    options: FilterOptions,
  ) {
    // Group-by's Empty group is NULL only; 0-rated records have their own 0 group.
    if (rootArgs.filter.groupby) {
      return super.filterBlank(args, rootArgs, options);
    }

    const { sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb.whereNull(sourceField as any).orWhere(sourceField as any, 0);
        });
      },
    };
  }

  override async filterNotblank(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    _rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const { sourceField } = args;
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((nestedQb) => {
          nestedQb
            .whereNotNull(sourceField as any)
            .whereNot(sourceField as any, 0);
        });
      },
    };
  }
}
