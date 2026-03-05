import { Injectable, Logger } from '@nestjs/common';
import { IntegrationCategoryType } from 'nocodb-sdk';
import { COMPACTION_SYSTEM_PROMPT } from '../prompts';
import {
  COMPACTION_THRESHOLD,
  KEEP_RECENT_MESSAGES,
  MAX_HISTORY_TOKENS,
} from '../constants';
import { ChatContextService } from './chat-context.service';
import type { ChatMessageType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { AiIntegration } from '@noco-local-integrations/core';
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
    },
  ): Promise<{
    summary?: string;
    activeMessages: ChatMessageType[];
  }> {
    const {
      messages,
      existingSummary,
      maxHistoryTokens = MAX_HISTORY_TOKENS,
    } = params;

    // Single budget: MAX_HISTORY_TOKENS is the one source of truth.
    // Compaction triggers when messages exceed COMPACTION_THRESHOLD of this
    // budget, and the output (summary + recent messages) is guaranteed to
    // fit within it — no secondary trimming needed downstream.
    let totalTokens = 0;
    for (const msg of messages) {
      totalTokens += this.contextService.estimateMessageTokens(msg);
    }

    // If under threshold, return all messages unchanged
    if (totalTokens < maxHistoryTokens * COMPACTION_THRESHOLD) {
      return {
        summary: existingSummary,
        activeMessages: messages,
      };
    }

    // Over threshold — keep as many recent messages as fit in the budget
    // (after reserving space for the summary), and summarize the rest.
    const summaryBudget = Math.floor(maxHistoryTokens * 0.15); // ~15% for summary
    const messageBudget = maxHistoryTokens - summaryBudget;

    // Walk backwards from the newest message to find how many fit
    let keepCount = 0;
    let recentTokens = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.contextService.estimateMessageTokens(messages[i]);
      if (recentTokens + msgTokens > messageBudget) break;
      recentTokens += msgTokens;
      keepCount++;
    }

    // Always keep at least KEEP_RECENT_MESSAGES (unless there aren't that many)
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
