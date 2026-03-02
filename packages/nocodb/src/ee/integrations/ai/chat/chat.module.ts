import { forwardRef, Module } from '@nestjs/common';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { ChatContextService } from './services/chat-context.service';
import { ChatCompactionService } from './services/chat-compaction.service';
import { ChatLimitsService } from './services/chat-limits.service';
import { ChatToolRegistry } from './tools/chat-tool-registry';
import { NocoAiModule } from '~/integrations/ai/module/ai.module';
import { NocoModule } from '~/modules/noco.module';

@Module({
  imports: [forwardRef(() => NocoModule), forwardRef(() => NocoAiModule)],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatContextService,
    ChatCompactionService,
    ChatLimitsService,
    ChatToolRegistry,
  ],
  exports: [ChatService],
})
export class NocoChatModule {}
