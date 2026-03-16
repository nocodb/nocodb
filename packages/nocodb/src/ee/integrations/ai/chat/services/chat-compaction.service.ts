import { Injectable, Logger } from '@nestjs/common';
import { IntegrationCategoryType } from 'nocodb-sdk';
import type { ChatMessageType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { AiIntegration } from '@noco-local-integrations/core';
import { COMPACTION_SYSTEM_PROMPT } from '~/integrations/ai/chat/prompts';
import {
  COMPACTION_THRESHOLD,
  KEEP_RECENT_MESSAGES,
} from '~/integrations/ai/chat/constants';
import { ChatContextService } from '~/integrations/ai/chat/services/chat-context.service';
import { getHistoryBudget } from '~/integrations/ai/chat/helpers/tokenlens';
import Integration from '~/models/Integration';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ChatCompactionService {
  private readonly logger = new Logger(ChatCompactionService.name);

  constructor(private readonly contextService: ChatContextService) {}

  async compactIfNeeded(
    context: NcContext,
    params: {
      messages: ChatMessageType[];
      existingSummary?: string;
      maxHistoryTokens?: number;
      modelId?: string;
    },
  ): Promise<{
    summary?: string;
    activeMessages: ChatMessageType[];
  }> {
    const { messages, existingSummary, modelId } = params;

    const maxHistoryTokens =
      params.maxHistoryTokens ?? (await getHistoryBudget(modelId));

    let totalTokens = 0;
    for (const msg of messages) {
      totalTokens += await this.contextService.estimateMessageTokens(
        msg,
        modelId,
      );
    }

    if (totalTokens < maxHistoryTokens * COMPACTION_THRESHOLD) {
      return {
        summary: existingSummary,
        activeMessages: messages,
      };
    }

    const summaryBudget = Math.floor(maxHistoryTokens * 0.15);
    const messageBudget = maxHistoryTokens - summaryBudget;

    let keepCount = 0;
    let recentTokens = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = await this.contextService.estimateMessageTokens(
        messages[i],
        modelId,
      );
      if (recentTokens + msgTokens > messageBudget) break;
      recentTokens += msgTokens;
      keepCount++;
    }

    keepCount = Math.max(
      keepCount,
      Math.min(KEEP_RECENT_MESSAGES, messages.length),
    );

    const recentMessages = messages.slice(-keepCount);
    const olderMessages = messages.slice(0, -keepCount);

    if (olderMessages.length === 0) {
      return {
        summary: existingSummary,
        activeMessages: messages,
      };
    }

    try {
      const summary = await this.summarizeMessages(
        context,
        olderMessages,
        existingSummary,
      );
      return {
        summary,
        activeMessages: recentMessages,
      };
    } catch (e) {
      this.logger.error('Failed to compact messages', e.stack);
      return {
        summary: existingSummary,
        activeMessages: recentMessages,
      };
    }
  }

  private async summarizeMessages(
    context: NcContext,
    messages: ChatMessageType[],
    existingSummary?: string,
  ): Promise<string> {
    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      NcError.get(context).integrationNotFound('AI');
    }

    const wrapper = integration.getIntegrationWrapper<AiIntegration>();

    const conversationText = messages
      .map((m) => {
        const text = m.parts
          ? m.parts
              .filter(
                (p): p is Extract<typeof p, { type: 'text' }> =>
                  p.type === 'text',
              )
              .map((p) => p.text)
              .join('') || '(tool call)'
          : m.content || '(tool call)';
        return `[${m.role}]: ${text}`;
      })
      .join('\n');

    const prompt = existingSummary
      ? `Previous summary:\n${existingSummary}\n\nNew messages to incorporate:\n${conversationText}`
      : conversationText;

    const { data } = await wrapper.generateText({
      system: COMPACTION_SYSTEM_PROMPT,
      prompt,
    });

    return data;
  }
}
