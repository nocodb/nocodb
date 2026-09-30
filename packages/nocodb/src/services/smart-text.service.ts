import { Injectable } from '@nestjs/common';
import type { ProseMirrorDoc } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';

export interface SmartTextGetResult {
  pm: ProseMirrorDoc | null;
  markdown: string | null;
  /**
   * SHA-1 of the trimmed markdown this content represents. Clients echo it back
   * as `updateContent`'s `expectedMdHash` to get optimistic-concurrency
   * protection against overwriting a concurrent edit.
   */
  mdHash?: string | null;
}

/**
 * SmartText cell content service. CE stub — returns no-op results.
 * EE override (`src/ee/services/smart-text.service.ts`) provides the
 * full read/write implementation against `nc_row_meta` JSONB.
 */
@Injectable()
export class SmartTextService {
  async getContent(
    _context: NcContext,
    _param: {
      tableId: string;
      rowId: string;
      columnId: string;
    },
  ): Promise<SmartTextGetResult> {
    return { pm: null, markdown: null };
  }

  async updateContent(
    _context: NcContext,
    _param: {
      tableId: string;
      rowId: string;
      columnId: string;
      pmContent: ProseMirrorDoc;
      /**
       * Hash of the content the client believes it is editing. When supplied and
       * it no longer matches storage, the write is rejected as out-of-sync
       * instead of clobbering a concurrent edit.
       */
      expectedMdHash?: string;
      req: NcRequest;
    },
  ): Promise<SmartTextGetResult> {
    return { pm: null, markdown: null };
  }
}
