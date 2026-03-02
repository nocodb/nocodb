import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { HookSubscribersService } from '~/services/hook-subscribers.service';

@Injectable()
export class HookPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    private readonly hookSubscribersService: HookSubscribersService,
  ) {}
  operations = [
    'hookAddSubscribers' as const,
    'hookRemoveSubscriber' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: any;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'hookAddSubscribers':
        return await this.hookSubscribersService.addSubscribers(
          context,
          payload.hookId,
          payload.userIds,
        );
      case 'hookRemoveSubscriber':
        return await this.hookSubscribersService.removeSubscriber(
          context,
          payload.subscriberId,
        );
    }
  }
}
