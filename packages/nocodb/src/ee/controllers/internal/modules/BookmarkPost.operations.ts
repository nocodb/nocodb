import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { BookmarkService } from '~/services/bookmark.service';

@Injectable()
export class BookmarkPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(private readonly bookmarkService: BookmarkService) {}

  operations = [
    'bookmarkCreate',
    'bookmarkUpdate',
    'bookmarkDelete',
    'bookmarkGroupCreate',
    'bookmarkGroupUpdate',
    'bookmarkGroupDelete',
  ] as (keyof typeof OPERATION_SCOPES)[];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'bookmarkCreate':
        return await this.bookmarkService.bookmarkCreate(context, {
          body: payload,
          req,
        });
      case 'bookmarkUpdate':
        return await this.bookmarkService.bookmarkUpdate(context, {
          bookmarkId: payload.bookmarkId,
          body: payload,
          req,
        });
      case 'bookmarkDelete':
        return await this.bookmarkService.bookmarkDelete(context, {
          bookmarkId: payload.bookmarkId,
          req,
        });
      case 'bookmarkGroupCreate':
        return await this.bookmarkService.bookmarkGroupCreate(context, {
          body: payload,
          req,
        });
      case 'bookmarkGroupUpdate':
        return await this.bookmarkService.bookmarkGroupUpdate(context, {
          groupId: payload.groupId,
          body: payload,
          req,
        });
      case 'bookmarkGroupDelete':
        return await this.bookmarkService.bookmarkGroupDelete(context, {
          groupId: payload.groupId,
          req,
        });
    }
  }
}
