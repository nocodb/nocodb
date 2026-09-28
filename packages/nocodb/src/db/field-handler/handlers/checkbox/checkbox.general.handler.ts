import { type NcContext, ncIsUndefined, parseCheckboxValue } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type {
  FilterOptions,
  FilterVerificationResult,
} from '~/db/field-handler/field-handler.interface';
import type { Column, Filter } from '~/models';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

// pg won't compare or assign a boolean against an integer column, which a
// Checkbox can be mapped onto (e.g. an external table's `int` flag).
const isPgIntegerColumn = (
  clientType: string | undefined,
  column: Column,
): boolean =>
  clientType === 'pg' &&
  /^(int|smallint|bigint)/.test((column.dt ?? '').toLowerCase());

export class CheckboxGeneralHandler extends GenericFieldHandler {
  protected get checkedDbValue(): any {
    return true;
  }

  protected get notcheckedDbValue(): any {
    return false;
  }

  protected dbValueFor(
    checked: boolean,
    knex: CustomKnex,
    column: Column,
  ): any {
    if (isPgIntegerColumn(knex.clientType(), column)) return checked ? 1 : 0;
    return checked ? this.checkedDbValue : this.notcheckedDbValue;
  }

  override async filterChecked(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const checkedValue = this.dbValueFor(true, rootArgs.knex, rootArgs.column);
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where(args.sourceField as any, checkedValue);
      },
    };
  }

  // Checkbox columns store NULL for "never set" and false for "explicitly
  // unchecked"; both should match `notchecked`.
  override async filterNotchecked(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    _options: FilterOptions,
  ) {
    const notcheckedValue = this.dbValueFor(
      false,
      rootArgs.knex,
      rootArgs.column,
    );
    return {
      rootApply: undefined,
      clause: (qb: Knex.QueryBuilder) => {
        qb.where((grpdQb) => {
          grpdQb
            .whereNull(args.sourceField as any)
            .orWhere(args.sourceField as any, notcheckedValue);
        });
      },
    };
  }

  override async filterEq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ) {
    return super.filterEq(
      { ...args, val: this.integerFilterValue(args.val, rootArgs) },
      rootArgs,
      options,
    );
  }

  override async filterNeq(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ) {
    return super.filterNeq(
      { ...args, val: this.integerFilterValue(args.val, rootArgs) },
      rootArgs,
      options,
    );
  }

  // `eq`/`neq` values arrive as 'true'/'false', which pg can't cast to integer.
  private integerFilterValue(
    val: any,
    rootArgs: { knex: CustomKnex; column: Column },
  ) {
    if (!isPgIntegerColumn(rootArgs.knex.clientType(), rootArgs.column)) {
      return val;
    }
    const parsed = parseCheckboxValue(val);
    return parsed === true || parsed === false
      ? this.dbValueFor(parsed, rootArgs.knex, rootArgs.column)
      : val;
  }

  override async verifyFilter(filter: Filter, column: Column) {
    const supportedOperations = [
      'eq',
      'neq',
      'blank',
      'notblank',
      'checked',
      'notchecked',
      'is',
      'isnot',
    ];
    if (!supportedOperations.includes(filter.comparison_op)) {
      return {
        isValid: false,
        errors: [
          `Operation ${filter.comparison_op} is not supported for type ${column.uidt} on column ${column.title}`,
        ],
      } as FilterVerificationResult;
    }
    if (
      ['eq', 'neq'].includes(filter.comparison_op) &&
      ![null, true, false, 'true', 'false', '', 1, 0, '1', '0'].includes(
        filter.value,
      )
    ) {
      return {
        isValid: false,
        errors: [
          `Value ${filter.value} is not supported for type ${column.uidt} on column ${column.title}`,
        ],
      } as FilterVerificationResult;
    }
    return {
      isValid: true,
    } as FilterVerificationResult;
  }

  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    if (ncIsUndefined(params.value)) {
      return { value: params.value };
    }

    const parsedCheckboxValue = parseCheckboxValue(params.value);

    if (parsedCheckboxValue === true || parsedCheckboxValue === false) {
      const knex = params.options?.baseModel?.dbDriver;
      return {
        value:
          knex && isPgIntegerColumn(knex.clientType(), params.column)
            ? +parsedCheckboxValue
            : parsedCheckboxValue,
      };
    } else {
      NcError.invalidValueForField({
        value: params.value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }
  }
}
