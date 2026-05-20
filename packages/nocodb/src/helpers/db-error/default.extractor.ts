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
    // the delimiter. Honor it when present.
    //
    // Do NOT pass the raw `error.message` through for unmapped error
    // codes — Knex prepends the full SQL query, and node/connection
    // errors carry internal hostnames / file paths. User-authored
    // exceptions (`RAISE EXCEPTION 'Currency mismatch ...'`) are
    // handled safely via the per-SQLSTATE case in `PgDBErrorExtractor`
    // (`P0001`-`P0004` using `pgRawMessage`); they don't need this
    // fallback. Anything that lands here is unmapped — leave the
    // message undefined and surface a generic error to the client.
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
