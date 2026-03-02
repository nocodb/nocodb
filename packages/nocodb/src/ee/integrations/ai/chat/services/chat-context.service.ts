import { Injectable } from '@nestjs/common';
import { ChatMessageRole } from 'nocodb-sdk';
import {
  buildDynamicSystemPromptText,
  buildStaticSystemPromptText,
} from '../prompts';
import type { ChatMessageType } from 'nocodb-sdk';
import type { ModelMessage, SystemModelMessage } from 'ai';
import type { NcContext } from '~/interface/config';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';

const MAX_HISTORY_TOKENS = 8000;

// Static content is identical for every request — build once and reuse.
const STATIC_SYSTEM_PROMPT = buildStaticSystemPromptText();

@Injectable()
export class ChatContextService {
  constructor(private readonly aiSchemaService: AiSchemaService) {}

  /**
   * Returns the system prompt as two SystemModelMessage blocks:
   * 1. Static block (Identity + Rules + Field Types + Filter Operators + Query Syntax)
   *    tagged with cache_control so Anthropic caches it at the API-key level.
   *    Shared across all users hitting the same AI integration.
   * 2. Dynamic block (user role + base schema + current context) — never cached.
   */
  async buildSystemPrompt(
    context: NcContext,
    params: {
      baseId: string;
      tableId?: string;
      viewId?: string;
      userRole: string;
      req: any;
    },
  ): Promise<SystemModelMessage[]> {
    const { baseId, tableId, userRole, req } = params;

    const serializedSchema = await this.aiSchemaService.serializeSchema(
      context,
      {
        baseId,
        tableIds: tableId ? [tableId] : undefined,
        req,
      },
    );

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
    if (tableId && serializedSchema.tables?.length) {
      const table = serializedSchema.tables[0];
      if (table?.title) {
        currentTableContext = `User is viewing table "${table.title}".`;
      }
    }

    return [
      {
        role: 'system',
        content: STATIC_SYSTEM_PROMPT,
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      },
      {
        role: 'system',
        content: buildDynamicSystemPromptText({
          schemaContext,
          currentTableContext,
          userRole,
        }),
      },
    ];
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
          // Emit assistant message with tool-call parts
          coreMessages.push({
            role: 'assistant',
            content: msg.tool_calls.map((tc) => ({
              type: 'tool-call' as const,
              toolCallId: tc.id,
              toolName: tc.name,
              input: tc.arguments,
            })),
          });

          // Emit matching tool-result messages so the provider sees complete pairs.
          // Results are stored on the same assistant message, not as separate TOOL rows.
          if (msg.tool_results?.length) {
            for (const result of msg.tool_results) {
              coreMessages.push({
                role: 'tool',
                content: [
                  {
                    type: 'tool-result' as const,
                    toolCallId: result.tool_call_id,
                    toolName:
                      msg.tool_calls.find((tc) => tc.id === result.tool_call_id)
                        ?.name || '',
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

          // Emit the final text content after tool results (the AI's response after tool use)
          if (msg.content) {
            coreMessages.push({
              role: 'assistant',
              content: msg.content,
            });
          }
        } else {
          coreMessages.push({
            role: 'assistant',
            content: msg.content || '',
          });
        }
      } else if (msg.role === ChatMessageRole.TOOL) {
        // Standalone TOOL messages (future-proofing)
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

  /**
   * Builds the message history without appending a new user message.
   * Used for LLM continuation after tool approvals — the last messages in
   * the history are tool results, so the LLM responds to them directly.
   */
  buildHistoryMessages(params: {
    messages: ChatMessageType[];
    summary?: string;
    maxHistoryTokens?: number;
  }): ModelMessage[] {
    const { messages, summary, maxHistoryTokens = MAX_HISTORY_TOKENS } = params;

    // Reuse buildMessages but pass an empty continuation marker so the LLM
    // responds to the tool results rather than a new user message.
    return this.buildMessages({
      messages,
      newUserMessage: '',
      summary,
      maxHistoryTokens,
    }).filter((m) => !(m.role === 'user' && (m.content as string) === ''));
  }

  estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil((text || '').length / 4);
  }
}
