import { Injectable, Logger } from '@nestjs/common';
import {
  ChatMessageRole,
  IntegrationCategoryType,
  PlanFeatureTypes,
} from 'nocodb-sdk';
import type { SuggestionType } from '~/integrations/ai/chat/prompts/suggestions';
import type { ChatContentBlock } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { AiIntegration } from '@noco-local-integrations/core';
import { chatAi, chatTraced } from '~/integrations/ai/chat/braintrust.init';
import { ChatSessionService } from '~/integrations/ai/chat/services/chat-session.service';
import {
  buildFollowUpMessages,
  buildSuggestionMessages,
  SUGGESTION_TYPES,
} from '~/integrations/ai/chat/prompts/suggestions';
import ChatMessage from '~/models/ChatMessage';
import Integration from '~/models/Integration';
import User from '~/models/User';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { getBaseSchema } from '~/helpers/scriptHelper';
import { DataV3Service } from '~/services/v3/data-v3.service';

@Injectable()
export class ChatSuggestionsService {
  private readonly logger = new Logger(ChatSuggestionsService.name);

  constructor(
    private readonly sessionService: ChatSessionService,
    private readonly dataV3Service: DataV3Service,
  ) {}

  async getSuggestions(
    context: NcContext,
    params: {
      type?: string;
      fileNames?: string[];
      req: NcRequest;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);

    const { type, req } = params;

    const suggestionType = (
      Object.values(SUGGESTION_TYPES).includes(type as SuggestionType)
        ? type
        : SUGGESTION_TYPES.RECOMMENDED
    ) as SuggestionType;

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      NcError.get(context).badRequest('No AI integration configured');
    }

    let model: ReturnType<AiIntegration['getModel']>;
    try {
      const wrapper = integration.getIntegrationWrapper<AiIntegration>();
      model = wrapper.getModel();
    } catch (e) {
      this.logger.error('Failed to initialise AI provider', e.stack);
      NcError.get(context).badRequest('Failed to initialise AI provider');
    }

    let schema = '';

    try {
      const baseSchema = await getBaseSchema(context);

      // Cap tables to avoid oversized prompts
      const MAX_TABLES = 10;
      const cappedTables = (baseSchema.tables || []).slice(0, MAX_TABLES);

      // Enrich with sample records (don't mutate cached schema)
      const tables = await Promise.all(
        cappedTables.map(async (table: any) => {
          try {
            const result = await this.dataV3Service.dataList(context, {
              modelId: table.id,
              query: { limit: '2', offset: '0', shuffle: '1' },
              req,
            });
            return {
              ...table,
              sampleRecords: (result as any)?.records || [],
            };
          } catch {
            return table;
          }
        }),
      );

      schema = JSON.stringify({ ...baseSchema, tables });

      // Suggestions only need enough schema to reference real data — cap aggressively
      const MAX_SCHEMA_SIZE = 30_000; // ~30KB — enough for table names + sample records
      if (schema.length > MAX_SCHEMA_SIZE) {
        const half = Math.floor(MAX_SCHEMA_SIZE / 2);
        schema =
          schema.slice(0, half) +
          '\n...(schema truncated)...\n' +
          schema.slice(-half);
      }
    } catch (e) {
      this.logger.warn(
        `Failed to build schema for suggestions: ${e.message}`,
        e.stack,
      );
    }

    const user = await User.get(req.user?.id);

    const messages = buildSuggestionMessages({
      schema,
      user: user || req.user,
      type: suggestionType,
      fileNames: params.fileNames,
    });

    try {
      const result = await chatTraced(
        `suggestions:${suggestionType}`,
        async (span) => {
          span?.log({
            metadata: {
              workspaceId: context.workspace_id,
              baseId: context.base_id,
              userId: req.user?.id,
              suggestionType,
            },
            tags: ['chat', 'suggestions', suggestionType],
          });
          return chatAi.generateText({
            model,
            messages,
            maxOutputTokens: 1024,
          });
        },
      );

      const suggestions = result.text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.length <= 120);

      return { suggestions };
    } catch (e) {
      this.logger.error('Failed to generate suggestions', e.stack);
      return { suggestions: [] };
    }
  }

  async getFollowUps(
    context: NcContext,
    params: {
      sessionId: string;
      req: NcRequest;
    },
  ): Promise<{ followUps: string[] }> {
    const { sessionId, req } = params;

    await this.sessionService.sessionGet(context, { sessionId, req });

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );
    if (!integration) return { followUps: [] };

    let model: ReturnType<AiIntegration['getModel']>;
    try {
      const wrapper = integration.getIntegrationWrapper<AiIntegration>();
      model = wrapper.getModel();
    } catch {
      return { followUps: [] };
    }

    const recentMessages = await ChatMessage.list(context, {
      sessionId,
      limit: 10,
    });

    let lastAssistantParts: ChatContentBlock[] | undefined;
    let lastUserMessage: string | undefined;

    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (
        !lastAssistantParts &&
        msg.role === ChatMessageRole.ASSISTANT &&
        msg.parts?.length
      ) {
        lastAssistantParts = msg.parts;
      }
      if (
        !lastUserMessage &&
        msg.role === ChatMessageRole.USER &&
        msg.content
      ) {
        lastUserMessage = msg.content;
      }
      if (lastAssistantParts && lastUserMessage) break;
    }

    if (!lastAssistantParts || !lastUserMessage) return { followUps: [] };

    try {
      const followUps = await this.generateFollowUps(
        context,
        model,
        lastAssistantParts,
        lastUserMessage,
        req,
      );
      return { followUps: followUps || [] };
    } catch {
      return { followUps: [] };
    }
  }

  /**
   * Generate follow-up suggestions from content blocks.
   * Used by both the follow-ups API endpoint and the agent service (after executeTurn).
   */
  async generateFollowUps(
    context: NcContext,
    model: any,
    contentBlocks: ChatContentBlock[],
    lastUserMessage: string,
    req?: NcRequest,
  ): Promise<string[] | undefined> {
    if (!lastUserMessage || !context.base_id) return undefined;

    const assistantText = contentBlocks
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    if (!assistantText) return undefined;

    const baseSchema = await getBaseSchema(context);

    // Cap tables and enrich with sample records for richer context
    const MAX_TABLES = 10;
    let tables = (baseSchema.tables || []).slice(0, MAX_TABLES);
    if (req) {
      tables = await Promise.all(
        tables.map(async (table: any) => {
          try {
            const result = await this.dataV3Service.dataList(context, {
              modelId: table.id,
              query: { limit: '2', offset: '0', shuffle: '1' },
              req,
            });
            return { ...table, sampleRecords: (result as any)?.records || [] };
          } catch {
            return table;
          }
        }),
      );
    }

    let schema = JSON.stringify({ ...baseSchema, tables });

    const MAX_SCHEMA_SIZE = 30_000;
    if (schema.length > MAX_SCHEMA_SIZE) {
      schema = schema.slice(0, MAX_SCHEMA_SIZE) + '...(truncated)';
    }

    const messages = buildFollowUpMessages({
      schema,
      lastAssistantText:
        assistantText.length > 2000
          ? assistantText.slice(0, 2000) + '...'
          : assistantText,
      lastUserMessage,
    });

    const result = await chatTraced('suggestions:follow-up', async (span) => {
      span?.log({
        metadata: {
          workspaceId: context.workspace_id,
          baseId: context.base_id,
          userId: req?.user?.id,
        },
        tags: ['chat', 'suggestions', 'follow-up'],
      });
      return chatAi.generateText({ model, messages, maxOutputTokens: 1024 });
    });

    const followUps = result.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.length <= 120);

    return followUps.length > 0 ? followUps.slice(0, 3) : undefined;
  }
}
