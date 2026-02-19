import { type NcContext, normalizeHexColour } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class ColourGeneralHandler extends GenericFieldHandler {
  /**
   * Validate and normalise user input for a Colour field.
   *
   * Accepts hex colours with or without a `#` prefix (e.g. `FF5733` or
   * `#ff5733`).  The value is normalised to uppercase `#RRGGBB` format.
   * Invalid input triggers {@link NcError.invalidValueForField}.
   */
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
    const { value, column } = params;

    if (!value) {
      return { value: null };
    }

    const normalized = normalizeHexColour(value);

    if (!normalized) {
      NcError.invalidValueForField({
        value,
        column: column.title,
        type: column.uidt,
      });
    }

    return { value: normalized };
  }
}
