import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { SandboxesService } from '~/services/sandboxes.service';

@Injectable()
export class SandboxGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  httpMethod = 'GET' as const;
  operations = [
    'sandboxGet',
    'sandboxDiff',
  ] as (keyof typeof OPERATION_SCOPES)[];

  constructor(private readonly sandboxesService: SandboxesService) {}

  async handle(
    context: NcContext,
    {
      baseId,
      operation,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'sandboxGet':
        return await this.sandboxesService.sandboxGet(context, { baseId });
      case 'sandboxDiff':
        return {
          diff: await this.sandboxesService.sandboxDiff(context, {
            baseId,
            user: req.user,
            req,
          }),
        };
      default:
        return null;
    }
  }
}
