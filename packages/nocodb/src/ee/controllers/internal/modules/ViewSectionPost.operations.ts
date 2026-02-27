import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { ViewSectionsService } from '~/ee/services/view-sections.service';

@Injectable()
export class ViewSectionPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(private readonly viewSectionsService: ViewSectionsService) {}

  operations = [
    'viewSectionCreate' as const,
    'viewSectionUpdate' as const,
    'viewSectionDelete' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
      payload,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload?: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'viewSectionCreate':
        return await this.viewSectionsService.create(
          context,
          req.query.tableId as string,
          payload,
          req,
        );

      case 'viewSectionUpdate':
        return await this.viewSectionsService.update(
          context,
          req.query.sectionId as string,
          payload,
          req,
        );

      case 'viewSectionDelete':
        return await this.viewSectionsService.delete(
          context,
          req.query.sectionId as string,
          req,
        );
    }
  }
}
