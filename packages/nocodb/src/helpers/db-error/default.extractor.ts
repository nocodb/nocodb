import { NcErrorType } from 'nocodb-sdk';
import type { Logger } from '@nestjs/common';
import type { DBErrorExtractResult, IClientDbErrorExtractor } from './utils';

export class DefaultDBErrorExtractor implements IClientDbErrorExtractor {
  constructor(
    private readonly option?: {
      dbErrorLogger?: Logger;
    },
  ) {}

  extract(error: any): DBErrorExtractResult {
    if (!error.code) return;

    let message: string | undefined;
    const httpStatus = 422;

    // log error for unknown error code
    this.option?.dbErrorLogger?.error(error);

    // if error message contains -- then extract message after --
    if (error.message?.includes('--')) {
      message = error.message.split('--')[1]?.trim();
    }

    return {
      error: NcErrorType.ERR_DATABASE_OP_FAILED,
      message,
      code: error.code,
      httpStatus,
    };
  }
}
