import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { BookmarkService } from '~/services/bookmark.service';

@Injectable()
export class BookmarkGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(private readonly bookmarkService: BookmarkService) {}

  operations = [
    'bookmarkList',
    'bookmarkCheck',
    'bookmarkGroupList',
  ] as (keyof typeof OPERATION_SCOPES)[];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'bookmarkList':
        return await this.bookmarkService.bookmarkList(context, { req });
      case 'bookmarkCheck':
        return await this.bookmarkService.bookmarkCheck(context, { req });
      case 'bookmarkGroupList':
        return await this.bookmarkService.bookmarkGroupList(context, { req });
    }
  }
}
