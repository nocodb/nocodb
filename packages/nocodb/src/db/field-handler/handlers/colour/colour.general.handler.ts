import { type NcContext } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class ColourGeneralHandler extends GenericFieldHandler {
  async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    let value = params.value;

    // Handle null/empty values
    if (!value) {
      return { value: null };
    }

    // Convert to string
    value = value.toString().trim();

    if (!value) {
      return { value: null };
    }

    // Validate hex color format
    const hexPattern = /^#?([0-9A-Fa-f]{6})$/;
    const match = value.match(hexPattern);

    if (!match) {
      NcError.invalidValueForField({
        value: value,
        column: params.column.title,
        type: params.column.uidt,
      });
    }

    // Normalize to #RRGGBB format (uppercase)
    const normalizedValue = `#${match[1].toUpperCase()}`;

    return { value: normalizedValue };
  }
}