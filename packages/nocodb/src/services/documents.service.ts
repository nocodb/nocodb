import { Injectable } from '@nestjs/common';
import type { DocumentType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class DocumentsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async list(
    _context: NcContext,
    _baseId: string,
    _parentId: string | null,
    _req?: NcRequest,
  ): Promise<DocumentType[]> {
    return [];
  }

  async listAll(
    _context: NcContext,
    _baseId: string,
    _req?: NcRequest,
  ): Promise<DocumentType[]> {
    return [];
  }

  async get(
    _context: NcContext,
    _docId: string,
    _req?: NcRequest,
  ): Promise<DocumentType> {
    return null;
  }

  async create(
    _context: NcContext,
    _payload: Partial<DocumentType>,
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

  async delete(
    _context: NcContext,
    _docId: string,
    _req: NcRequest,
  ): Promise<boolean> {
    return true;
  }

  async reorder(
    _context: NcContext,
    _docId: string,
    _payload: { order: number; parent_id?: string | null },
    _req: NcRequest,
  ): Promise<DocumentType> {
    return null;
  }
}
