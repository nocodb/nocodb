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

    // Legacy convention: messages with `--` carry a user-safe half after
    // the delimiter. Honor it when present so we don't regress callers
    // that rely on it.
    if (error.message?.includes('--')) {
      message = error.message.split('--')[1]?.trim();
    } else if (typeof error.message === 'string' && error.message.trim()) {
      // Otherwise pass the raw DB message through. User-authored
      // exceptions (`RAISE EXCEPTION 'Currency mismatch ...'` etc.) and
      // unmapped SQLSTATEs both end up here — surfacing the message is
      // better than the previous behavior of silently dropping it.
      message = error.message.trim();
    }

    return {
      error: NcErrorType.ERR_DATABASE_OP_FAILED,
      message,
      code: error.code,
      httpStatus,
    };
  }
}
