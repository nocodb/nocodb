import { forwardRef, Module } from '@nestjs/common';
import { ChatController } from '~/integrations/ai/chat/controllers/chat.controller';
import { ChatService } from '~/integrations/ai/chat/services/chat.service';
import { ChatSessionService } from '~/integrations/ai/chat/services/chat-session.service';
import { ChatSuggestionsService } from '~/integrations/ai/chat/services/chat-suggestions.service';
import { ChatContextService } from '~/integrations/ai/chat/services/chat-context.service';
import { ChatCompactionService } from '~/integrations/ai/chat/services/chat-compaction.service';
import { ChatAgentService } from '~/integrations/ai/chat/services/chat-agent.service';
import { ChatToolRegistry } from '~/integrations/ai/chat/tools/chat-tool-registry';
import { ChatMessageProcessor } from '~/modules/jobs/jobs/chat-message.processor';
import { ChatApprovalProcessor } from '~/modules/jobs/jobs/chat-approval.processor';
import { NocoAiModule } from '~/integrations/ai/module/ai.module';
import { NocoModule } from '~/modules/noco.module';

@Module({
  imports: [forwardRef(() => NocoModule), forwardRef(() => NocoAiModule)],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatSessionService,
    ChatSuggestionsService,
    ChatContextService,
    ChatCompactionService,
    ChatAgentService,
    ChatToolRegistry,
    ChatMessageProcessor,
    ChatApprovalProcessor,
  ],
  exports: [
    ChatService,
    ChatSessionService,
    ChatSuggestionsService,
    ChatAgentService,
    ChatMessageProcessor,
    ChatApprovalProcessor,
  ],
})
export class NocoChatModule {}
