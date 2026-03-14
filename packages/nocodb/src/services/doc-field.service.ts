import { Injectable } from '@nestjs/common';
import type { DocumentType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class DocFieldService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async get(
    _context: NcContext,
    _columnId: string,
    _rowId: string,
  ): Promise<DocumentType> {
    return null;
  }

  async getOrCreate(
    _context: NcContext,
    _columnId: string,
    _rowId: string,
    _req: NcRequest,
  ): Promise<DocumentType> {
    return null;
  }

  async update(
    _context: NcContext,
    _docId: string,
    _payload: Partial<DocumentType>,
    _req: NcRequest,
  ): Promise<DocumentType> {
    return null;
  }
}
