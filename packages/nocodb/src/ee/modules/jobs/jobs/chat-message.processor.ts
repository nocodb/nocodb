import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import type { ChatMessageJobData } from '~/interface/Jobs';
import type { NcRequest } from '~/interface/config';
import { ChatService } from '~/integrations/ai/chat/services/chat.service';

@Injectable()
export class ChatMessageProcessor {
  private readonly logger = new Logger(ChatMessageProcessor.name);

  constructor(private readonly chatService: ChatService) {}

  async job(job: Job<ChatMessageJobData>): Promise<void> {
    const { context, user, sessionId, firstUserMessage, approvals } = job.data;

    const req = { user } as NcRequest;

    const callbacks = this.chatService.buildSocketCallbacks(
      user.id as string,
      sessionId,
      context.base_id,
      this.logger,
    );

    await this.chatService.processAgentTurn(
      context,
      { sessionId, req, approvals, firstUserMessage },
      callbacks,
    );
  }
}
