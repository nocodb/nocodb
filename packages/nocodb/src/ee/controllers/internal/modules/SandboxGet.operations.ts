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
    'sandboxList',
    'sandboxGet',
    'sandboxDiff',
    'sandboxChangelog',
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
      case 'sandboxList':
        return await this.sandboxesService.sandboxList({
          baseId,
        });
      case 'sandboxGet':
        return await this.sandboxesService.sandboxGet(context, {
          sandboxId: req.query?.sandboxId as string,
        });
      case 'sandboxDiff':
        return (await this.sandboxesService.sandboxDiff(context, {
          user: req.user,
          req,
        })) as any;
      case 'sandboxChangelog':
        return (await this.sandboxesService.sandboxChangelog(context, {
          user: req.user,
          req,
          excludeMerged: req.query?.excludeMerged !== 'false',
        })) as any;
      default:
        return null;
    }
  }
}
