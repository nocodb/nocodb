import { Injectable } from '@nestjs/common';
import { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { checkForFeature, checkLimit } from '~/helpers/paymentHelpers';
import ChatMessage from '~/models/ChatMessage';

@Injectable()
export class ChatLimitsService {
  async checkFeatureGate(context: NcContext): Promise<void> {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);
  }

  async checkCanSendMessage(
    context: NcContext,
    _params: {
      userId: string;
    },
  ): Promise<void> {
    // Check feature gate first
    await this.checkFeatureGate(context);

    // Check monthly message limit
    const currentCount = await ChatMessage.countByWorkspaceAndMonth(
      context,
      context.workspace_id,
    );

    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_AI_CHAT_MESSAGES_PER_MONTH,
      count: currentCount,
      delta: 1,
    });
  }
}
