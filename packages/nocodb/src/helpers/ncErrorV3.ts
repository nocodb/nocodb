import { NcErrorType } from 'nocodb-sdk';
import { NcErrorV1 } from './NcErrorV1';

export class NcErrorV3 extends NcErrorV1 {
  constructor() {
    super();
    this.errorCodex.setErrorCodexes({
      [NcErrorType.INVALID_FILTER]: {
        message: (message: string) => `Invalid filter expression: ${message}`,
        code: 422,
      },
      [NcErrorType.BASE_NOT_FOUND]: {
        message: (id: string) => `Base '${id}' not found`,
        code: 422,
      },
      [NcErrorType.TABLE_NOT_FOUND]: {
        message: (id: string) => `Table '${id}' not found`,
        code: 422,
      },
      [NcErrorType.VIEW_NOT_FOUND]: {
        message: (id: string) => `View '${id}' not found`,
        code: 422,
      },
      [NcErrorType.FIELD_NOT_FOUND]: {
        message: (id: string) => `Field '${id}' not found`,
        code: 422,
      },
    });
  }
}
