import { JsonGeneralHandler } from './json.general.handler';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

/**
 * SQL Server JSON handler.
 *
 * Two underlying column types can carry the JSON UI type on SQL Server:
 *   1. The native `json` type (SQL Server 2025 / Azure SQL). Like `xml`, it
 *      forbids implicit conversion to/from strings, so string comparisons must
 *      `CAST(col AS NVARCHAR(MAX))` and inserts must `CAST(@p AS json)`.
 *      (json-data-type.md: "All implicit conversions aren't allowed, similar to
 *      the behavior of xml.")
 *   2. An `nvarchar`/`varchar` column a user manually typed as JSON (the only
 *      possibility on 2016-2022, which have no native `json` type). These behave
 *      exactly like the generic handler — plain string comparison, no cast.
 *      Casting here would be wrong (and `CAST(... AS json)` would error on a
 *      server with no `json` type).
 *
 * So the cast is gated on `column.dt === 'json'` and is otherwise a no-op
 * delegating to the generic behavior.
 */
export class JsonMssqlHandler extends JsonGeneralHandler {
  private isNativeJson(column?: Column): boolean {
    return (column?.dt || (column as any)?.dt_s)?.toLowerCase() === 'json';
  }

  protected override fieldExpr(column?: Column): string {
    return this.isNativeJson(column) ? 'CAST(?? AS NVARCHAR(MAX))' : '??';
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
    const result = await super.parseUserInput(params);

    const knex = params.options?.baseModel?.dbDriver;
    if (
      !this.isNativeJson(params.column) ||
      !knex ||
      result?.value === null ||
      result?.value === undefined
    ) {
      // nvarchar-backed JSON (or no driver): store the plain string as-is.
      return result;
    }

    // Native `json` column: implicit nvarchar->json assignment is rejected,
    // so cast explicitly (nvarchar -> json is an allowed explicit conversion).
    return { value: knex.raw('CAST(? AS json)', [result.value]) };
  }
}
