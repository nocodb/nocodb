import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { ViewSectionsService } from '~/ee/services/view-sections.service';

@Injectable()
export class ViewSectionGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(private readonly viewSectionsService: ViewSectionsService) {}

  operations = ['viewSectionList' as const];
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
      payload?: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'viewSectionList':
        return {
          list: await this.viewSectionsService.list(
            context,
            req.query.tableId as string,
          ),
        } as any;
    }
  }
}
