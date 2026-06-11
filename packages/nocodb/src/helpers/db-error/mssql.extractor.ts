import type { Logger } from '@nestjs/common';
import type {
  DBErrorExtractResult,
  IClientDbErrorExtractor,
} from '~/helpers/db-error/utils';

export class MssqlDBErrorExtractor implements IClientDbErrorExtractor {
  constructor(_option?: { dbErrorLogger?: Logger }) {}

  extract(_error: any): DBErrorExtractResult {
    return undefined;
  }
}
