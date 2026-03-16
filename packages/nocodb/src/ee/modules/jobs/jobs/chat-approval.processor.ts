import { Injectable, Logger } from '@nestjs/common';
import { ChatEventAction, EventType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { ChatApprovalJobData } from '~/interface/Jobs';
import type { NcRequest } from '~/interface/config';
import { ChatAgentService } from '~/integrations/ai/chat/services/chat-agent.service';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class ChatApprovalProcessor {
  private readonly logger = new Logger(ChatApprovalProcessor.name);

  constructor(private readonly agentService: ChatAgentService) {}

  async job(job: Job<ChatApprovalJobData>): Promise<void> {
    const { context, user, sessionId, messageId, decisions } = job.data;

    const req = { user } as NcRequest;

    // 1. Execute approved tools and persist results
    let updatedParts;
    try {
      updatedParts = await this.agentService.executeApprovals(context, {
        sessionId,
        messageId,
        decisions,
        req,
      });
    } catch (e) {
      this.logger.error(
        `Failed to execute approvals for message ${messageId}`,
        e.stack,
      );
      NocoSocket.broadcastEventToUser(user.id as string, {
        event: EventType.CHAT_EVENT,
        payload: {
          action: ChatEventAction.ERROR,
          sessionId,
          error: 'Failed to execute tool approvals',
        },
      });
      return;
    }

    // 2. Push the updated tool results to the frontend
    if (updatedParts) {
      NocoSocket.broadcastEventToUser(user.id as string, {
        event: EventType.CHAT_EVENT,
        payload: {
          action: ChatEventAction.MESSAGE_UPDATE,
          sessionId,
          messageId,
          parts: updatedParts,
        },
      });
    }

    // 3. Continue the LLM conversation
    const callbacks = this.agentService.buildSocketCallbacks(
      user.id as string,
      sessionId,
      context.workspace_id,
      this.logger,
    );

    try {
      await this.agentService.executeTurn(
        context,
        { sessionId, req, approvals: {} },
        callbacks,
      );
    } catch (e) {
      this.logger.error(
        `Failed to continue LLM turn for session ${sessionId}`,
        e.stack,
      );
      NocoSocket.broadcastEventToUser(user.id as string, {
        event: EventType.CHAT_EVENT,
        payload: {
          action: ChatEventAction.ERROR,
          sessionId,
          error: 'Failed to continue conversation after approval',
        },
      });
    }
  }
}
