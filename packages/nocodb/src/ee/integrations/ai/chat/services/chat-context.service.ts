import { Injectable } from '@nestjs/common';
import { ChatMessageRole } from 'nocodb-sdk';
import { buildSystemPromptText } from '../prompts';
import type { ChatMessageType } from 'nocodb-sdk';
import type { ModelMessage } from 'ai';
import type { NcContext } from '~/interface/config';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';

const MAX_HISTORY_TOKENS = 8000;

@Injectable()
export class ChatContextService {
  constructor(private readonly aiSchemaService: AiSchemaService) {}

  async buildSystemPrompt(
    context: NcContext,
    params: {
      baseId: string;
      tableId?: string;
      viewId?: string;
      userRole: string;
      availableToolNames: string[];
      req: any;
    },
  ): Promise<string> {
    const { baseId, tableId, userRole, availableToolNames, req } = params;

    // Serialize base schema using existing AI schema service
    const serializedSchema = await this.aiSchemaService.serializeSchema(
      context,
      {
        baseId,
        tableIds: tableId ? [tableId] : undefined,
        req,
      },
    );

    // Build compact schema text
    const schemaLines: string[] = [];

    for (const table of serializedSchema.tables) {
      const cols = table.columns
        .map((c) => {
          let desc = `${c.title} (${c.type})`;
          if (c.options?.length) {
            desc += ` [${c.options.join(', ')}]`;
          }
          return desc;
        })
        .join(', ');
      schemaLines.push(`Table "${table.title}": ${cols}`);
    }

    if (serializedSchema.relationships?.length) {
      const rels = serializedSchema.relationships
        .map((r) => `${r.from} ${r.type} ${r.to}`)
        .join('; ');
      schemaLines.push(`Relationships: ${rels}`);
    }

    const schemaContext = schemaLines.join('\n');

    let currentTableContext: string | undefined;
    if (tableId) {
      const table = serializedSchema.tables.find((t) =>
        serializedSchema.tables.some((st) => st.title === t.title),
      );
      if (table) {
        currentTableContext = `The user is currently viewing the "${table.title}" table.`;
      }
    }

    return buildSystemPromptText({
      schemaContext,
      currentTableContext,
      userRole,
      availableToolNames,
    });
  }

  buildMessages(params: {
    messages: ChatMessageType[];
    newUserMessage: string;
    summary?: string;
    maxHistoryTokens?: number;
  }): ModelMessage[] {
    const {
      messages,
      newUserMessage,
      summary,
      maxHistoryTokens = MAX_HISTORY_TOKENS,
    } = params;

    const coreMessages: ModelMessage[] = [];

    // Add summary of older messages if available
    if (summary) {
      coreMessages.push({
        role: 'system',
        content: `Previous conversation summary:\n${summary}`,
      });
    }

    // Add message history within token budget
    let tokenEstimate = summary ? this.estimateTokens(summary) : 0;

    for (const msg of messages) {
      const msgTokens = this.estimateTokens(msg.content || '');

      if (tokenEstimate + msgTokens > maxHistoryTokens) {
        break;
      }

      if (msg.role === ChatMessageRole.USER) {
        coreMessages.push({
          role: 'user',
          content: msg.content || '',
        });
      } else if (msg.role === ChatMessageRole.ASSISTANT) {
        if (msg.tool_calls?.length) {
          coreMessages.push({
            role: 'assistant',
            content: msg.tool_calls.map((tc) => ({
              type: 'tool-call' as const,
              toolCallId: tc.id,
              toolName: tc.name,
              input: tc.arguments,
            })),
          });
        } else {
          coreMessages.push({
            role: 'assistant',
            content: msg.content || '',
          });
        }
      } else if (msg.role === ChatMessageRole.TOOL) {
        if (msg.tool_results?.length) {
          for (const result of msg.tool_results) {
            coreMessages.push({
              role: 'tool',
              content: [
                {
                  type: 'tool-result' as const,
                  toolCallId: result.tool_call_id,
                  toolName: '',
                  output: {
                    type: 'text' as const,
                    value:
                      typeof result.output === 'string'
                        ? result.output
                        : JSON.stringify(result.output),
                  },
                },
              ],
            });
          }
        }
      }

      tokenEstimate += msgTokens;
    }

    // Add the new user message
    coreMessages.push({
      role: 'user',
      content: newUserMessage,
    });

    return coreMessages;
  }

  estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil((text || '').length / 4);
  }
}
