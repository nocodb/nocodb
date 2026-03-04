import { Injectable, Logger } from '@nestjs/common';
import { EventType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { ChatApprovalJobData } from '~/interface/Jobs';
import type { NcRequest } from '~/interface/config';
import { ChatService } from '~/integrations/ai/chat/services/chat.service';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class ChatApprovalProcessor {
  private readonly logger = new Logger(ChatApprovalProcessor.name);

  constructor(private readonly chatService: ChatService) {}

  async job(job: Job<ChatApprovalJobData>): Promise<void> {
    const { context, user, sessionId, messageId, decisions } = job.data;

    const req = { user } as NcRequest;

    // 1. Execute approved tools and persist results
    let updatedParts;
    try {
      updatedParts = await this.chatService.executeApprovals(context, {
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
          action: 'error',
          sessionId,
          error: 'Failed to execute tool approvals',
        },
      });
      return;
    }

    // 2. Push the updated tool results to the frontend so the original message
    //    reflects SUCCESS/DENIED with output (like Claude Code)
    if (updatedParts) {
      NocoSocket.broadcastEventToUser(user.id as string, {
        event: EventType.CHAT_EVENT,
        payload: {
          action: 'message-update',
          sessionId,
          messageId,
          parts: updatedParts,
        },
      });
    }

    // 3. Continue the LLM conversation now that tool results are in the history
    const callbacks = this.chatService.buildSocketCallbacks(
      user.id as string,
      sessionId,
      context.base_id,
      this.logger,
    );

    try {
      await this.chatService.processAgentTurn(
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
          action: 'error',
          sessionId,
          error: 'Failed to continue conversation after approval',
        },
      });
    }
  }
}
