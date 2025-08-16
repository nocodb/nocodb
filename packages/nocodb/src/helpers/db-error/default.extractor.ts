import { NcErrorType } from 'nocodb-sdk';
import type { DBError } from './utils';
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

    let message: string;
    let _extra: Record<string, any>;
    let _type: DBError;
    const httpStatus = 422;

    // log error for unknown error code
    this.option?.dbErrorLogger?.error(error);

    // if error message contains -- then extract message after --
    if (error.message?.includes('--')) {
      message = error.message.split('--')[1];
    }

    return {
      error: NcErrorType.DATABASE_ERROR,
      message,
      code: error.code,
      httpStatus,
    };
  }
}
