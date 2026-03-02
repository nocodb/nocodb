import { Injectable, Logger } from '@nestjs/common';
import { IntegrationCategoryType } from 'nocodb-sdk';
import { COMPACTION_SYSTEM_PROMPT } from '../prompts';
import { ChatContextService } from './chat-context.service';
import type { ChatMessageType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { AiIntegration } from '@noco-local-integrations/core';
import Integration from '~/models/Integration';
import { NcError } from '~/helpers/catchError';

const COMPACTION_THRESHOLD = 0.8;
const TOKEN_BUDGET = 16000;
const KEEP_RECENT_MESSAGES = 6;

@Injectable()
export class ChatCompactionService {
  private readonly logger = new Logger(ChatCompactionService.name);

  constructor(private readonly contextService: ChatContextService) {}

  async compactIfNeeded(
    context: NcContext,
    params: {
      messages: ChatMessageType[];
      existingSummary?: string;
      tokenBudget?: number;
    },
  ): Promise<{
    summary?: string;
    activeMessages: ChatMessageType[];
  }> {
    const { messages, existingSummary, tokenBudget = TOKEN_BUDGET } = params;

    // Estimate total tokens in message history
    let totalTokens = 0;
    for (const msg of messages) {
      totalTokens += this.contextService.estimateTokens(msg.content || '');
      if (msg.tool_calls) {
        totalTokens += this.contextService.estimateTokens(
          JSON.stringify(msg.tool_calls),
        );
      }
      if (msg.tool_results) {
        totalTokens += this.contextService.estimateTokens(
          JSON.stringify(msg.tool_results),
        );
      }
    }

    // If under threshold, return all messages unchanged
    if (totalTokens < tokenBudget * COMPACTION_THRESHOLD) {
      return {
        summary: existingSummary,
        activeMessages: messages,
      };
    }

    // Over threshold — compact older messages into summary
    const recentMessages = messages.slice(-KEEP_RECENT_MESSAGES);
    const olderMessages = messages.slice(0, -KEEP_RECENT_MESSAGES);

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
      // Fallback: keep recent messages without summary
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
      .map((m) => `[${m.role}]: ${m.content || '(tool call)'}`)
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
