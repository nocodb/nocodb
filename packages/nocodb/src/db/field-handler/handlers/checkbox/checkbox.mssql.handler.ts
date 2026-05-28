import { CheckboxGeneralHandler } from './checkbox.general.handler';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

export class CheckboxMssqlHandler extends CheckboxGeneralHandler {
  // knex's mssql dialect renders JS `true`/`false` as bare T-SQL identifiers
  // (e.g. `set [Done] = true`), which SQL Server rejects with "Invalid column
  // name 'true'". Checkbox columns are `bit` — emit 1/0 instead so knex
  // inlines them as valid integer literals.
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
    if (parsed.value === true) return { value: 1 };
    if (parsed.value === false) return { value: 0 };
    return parsed;
  }
}
