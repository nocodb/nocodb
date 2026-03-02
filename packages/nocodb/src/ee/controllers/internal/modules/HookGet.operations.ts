import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { HookSubscribersService } from '~/services/hook-subscribers.service';

@Injectable()
export class HookGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    private readonly hookSubscribersService: HookSubscribersService,
  ) {}
  operations = ['hookListSubscribers' as const];
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
      case 'hookListSubscribers':
        return await this.hookSubscribersService.listSubscribers(
          context,
          req.query.hookId as string,
        );
    }
  }
}
