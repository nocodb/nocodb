import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { SandboxesService } from '~/services/sandboxes.service';

@Injectable()
export class SandboxPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  httpMethod = 'POST' as const;
  operations = [
    'sandboxCreate',
    'sandboxDiscard',
    'sandboxMerge',
  ] as (keyof typeof OPERATION_SCOPES)[];

  constructor(private readonly sandboxesService: SandboxesService) {}

  async handle(
    context: NcContext,
    {
      baseId,
      operation,
      payload,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'sandboxCreate':
        return await this.sandboxesService.sandboxCreate(context, {
          baseId,
          user: req.user,
          req,
          options: payload?.options,
        });
      case 'sandboxDiscard':
        return await this.sandboxesService.sandboxDiscard(context, {
          baseId,
          user: req.user,
          req,
        });
      case 'sandboxMerge':
        return await this.sandboxesService.sandboxMerge(context, {
          baseId,
          user: req.user,
          req,
        });
      default:
        return null;
    }
  }
}
