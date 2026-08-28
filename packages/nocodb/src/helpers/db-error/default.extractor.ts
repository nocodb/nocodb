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

    if (error.code === 'EACCES') {
      return {
        error: NcErrorType.ERR_DATABASE_OP_FAILED,
        message: 'Connection to internal hosts is not allowed',
        code: 'EACCES',
        httpStatus: 403,
      };
    }

    let message: string | undefined;
    const httpStatus = 422;

    // log error for unknown error code. Pass the stack separately — Nest
    // renders a bare Error argument as its message alone, dropping the
    // stack and every driver field.
    this.option?.dbErrorLogger?.error(
      `Unhandled db error code ${error.code}: ${error.message}`,
      error.stack,
    );

    // if error message contains -- then extract message after --
    if (error.message?.includes('--')) {
      message = error.message.split('--')[1]?.trim();
    }

    return {
      error: NcErrorType.ERR_DATABASE_OP_FAILED,
      message,
      code: error.code,
      httpStatus,
      recognized: false,
    };
  }
}
