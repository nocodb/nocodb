import { forwardRef, Module } from '@nestjs/common';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatContextService } from './services/chat-context.service';
import { ChatCompactionService } from './services/chat-compaction.service';
import { ChatToolRegistry } from './tools/chat-tool-registry';
import { ChatMessageProcessor } from '~/modules/jobs/jobs/chat-message.processor';
import { ChatApprovalProcessor } from '~/modules/jobs/jobs/chat-approval.processor';
import { NocoAiModule } from '~/integrations/ai/module/ai.module';
import { NocoModule } from '~/modules/noco.module';

@Module({
  imports: [forwardRef(() => NocoModule), forwardRef(() => NocoAiModule)],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatContextService,
    ChatCompactionService,
    ChatToolRegistry,
    ChatMessageProcessor,
    ChatApprovalProcessor,
  ],
  exports: [ChatService, ChatMessageProcessor, ChatApprovalProcessor],
})
export class NocoChatModule {}
