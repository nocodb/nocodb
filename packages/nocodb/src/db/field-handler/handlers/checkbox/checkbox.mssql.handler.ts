import { parseCheckboxValue } from 'nocodb-sdk';
import { CheckboxGeneralHandler } from './checkbox.general.handler';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type {
  FilterOperationResult,
  FilterOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Knex } from '~/db/CustomKnex';
import type CustomKnex from '~/db/CustomKnex';
import type { Column, Filter } from '~/models';

// `parseCheckboxValue` already accepts boolean / '1' / '0' / 'true' / 'false'
// / 1 / 0 and returns `true | false | null`; we just map that to the bit
// literal MSSQL expects and pass unparseable values through untouched.
function toBitLiteral(value: any): any {
  const parsed = parseCheckboxValue(value);
  if (parsed === true) return 1;
  if (parsed === false) return 0;
  return value;
}

export class CheckboxMssqlHandler extends CheckboxGeneralHandler {
  // knex's mssql dialect renders JS `true`/`false` as bare T-SQL identifiers
  // (e.g. `set [Done] = true`), which SQL Server rejects with "Invalid column
  // name 'true'". Checkbox columns are `bit` — emit 1/0 instead so knex
  // inlines them as valid integer literals.
  protected override get checkedDbValue(): any {
    return 1;
  }

  protected override get notcheckedDbValue(): any {
    return 0;
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
    const parsed = await super.parseUserInput(params);
    return { value: toBitLiteral(parsed.value) };
  }

  override async handleFilter(
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: { knex: CustomKnex; filter: Filter; column: Column },
    options: FilterOptions,
  ): Promise<FilterOperationResult> {
    return super.handleFilter(
      { ...args, val: toBitLiteral(args.val) },
      rootArgs,
      options,
    );
  }
}
