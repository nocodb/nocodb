import { NcError } from 'src/helpers/catchError';
import { dataWrapper } from 'src/helpers/dbHelpers';
import { GenericFieldHandler } from '../generic';
import type { Column } from 'src/models';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from 'src/meta/meta.service';

// Schemes a browser runs instead of navigating. Whitespace and control
// characters are dropped first, as browsers do ("java\tscript:").
const EXECUTABLE_URL_SCHEME = /^(javascript|data|vbscript):/i;

export function isExecutableUrl(value: unknown) {
  return EXECUTABLE_URL_SCHEME.test(String(value).replace(/[\s\p{Cc}]/gu, ''));
}

export class UrlGeneralHandler extends GenericFieldHandler {
  override async parseUserInput(params: {
    value: any;
    row: any;
    oldData?: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    const value = (await super.parseUserInput(params))?.value;
    // An unchanged stored value still round-trips.
    const oldValue =
      params.oldData &&
      dataWrapper(params.oldData).getByColumnNameTitleOrId(params.column);
    if (
      value !== null &&
      value !== undefined &&
      value !== oldValue &&
      isExecutableUrl(value)
    ) {
      NcError.invalidValueForField({
        value: String(value),
        column: params.column.title,
        type: params.column.uidt,
        reason: 'javascript:, data: and vbscript: URLs are not allowed',
      });
    }
    return { value };
  }
}
