import { Injectable, Logger } from '@nestjs/common';
import { ChatEventAction, EventType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { ChatMessageJobData } from '~/interface/Jobs';
import type { NcContext, NcRequest } from '~/interface/config';
import { ChatAgentService } from '~/integrations/ai/chat/services/chat-agent.service';
import { Permission } from '~/models';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class ChatMessageProcessor {
  private readonly logger = new Logger(ChatMessageProcessor.name);

  constructor(private readonly agentService: ChatAgentService) {}

  async job(job: Job<ChatMessageJobData>): Promise<void> {
    const { context, user, sessionId, firstUserMessage, approvals } = job.data;

    const req = { user } as NcRequest;

    // Load table/field permissions so BaseModelSqlV2.checkPermission works
    if (context.base_id) {
      const permissions = await Permission.list(context, context.base_id);
      (req as any).permissions = permissions;
      context.permissions = permissions;
    }

    context.user = user as NcContext['user'];

    const callbacks = this.agentService.buildSocketCallbacks(
      user.id as string,
      sessionId,
      context.workspace_id,
      this.logger,
    );

    try {
      await this.agentService.executeTurn(
        context,
        { sessionId, req, approvals, firstUserMessage },
        callbacks,
      );
    } catch (e) {
      this.logger.error(
        `Failed to process chat message for session ${sessionId}`,
        e.stack,
      );
      NocoSocket.broadcastEventToUser(user.id as string, {
        event: EventType.CHAT_EVENT,
        payload: {
          action: ChatEventAction.ERROR,
          sessionId,
          error: 'Failed to process message',
        },
      });
    }
  }
}
