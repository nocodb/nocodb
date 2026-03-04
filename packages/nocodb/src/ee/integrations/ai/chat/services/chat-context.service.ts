import { Injectable } from '@nestjs/common';
import { ChatMessageRole } from 'nocodb-sdk';
import {
  buildDynamicSystemPromptText,
  buildStaticSystemPromptText,
} from '../prompts';
import { MAX_HISTORY_TOKENS } from '../constants';
import type { ChatMessageType } from 'nocodb-sdk';
import type { ModelMessage, SystemModelMessage } from 'ai';
import type { NcContext } from '~/interface/config';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';

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
      baseId?: string;
      tableId?: string;
      viewId?: string;
      userRole: string;
      req: any;
    },
  ): Promise<SystemModelMessage[]> {
    const { baseId, tableId, userRole, req } = params;

    let schemaContext = '';
    let currentTableContext: string | undefined;

    if (baseId) {
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

      schemaContext = schemaLines.join('\n');

      if (tableId && serializedSchema.tables?.length) {
        const table = serializedSchema.tables[0];
        if (table?.title) {
          currentTableContext = `User is viewing table "${table.title}".`;
        }
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

    // Add message history within token budget.
    // Iterate from the END (newest first) so the most recent messages —
    // including the latest user message — are always included. Older
    // messages are dropped first when the budget is exhausted.
    let tokenEstimate = summary ? this.estimateTokens(summary) : 0;

    // First pass: walk backwards to find the oldest message we can fit
    let startIndex = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateMessageTokens(messages[i]);
      if (tokenEstimate + msgTokens > maxHistoryTokens) {
        break;
      }
      tokenEstimate += msgTokens;
      startIndex = i;
    }

    // Second pass: emit messages in chronological order from startIndex
    for (let i = startIndex; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.role === ChatMessageRole.USER) {
        coreMessages.push({
          role: 'user',
          content: msg.content || '',
        });
      } else if (msg.role === ChatMessageRole.ASSISTANT) {
        if (msg.parts?.length) {
          const toolBlocks = msg.parts.filter(
            (p): p is Extract<typeof p, { type: 'tool_use' }> =>
              p.type === 'tool_use',
          );

          // Build a single assistant message with text and tool-call
          // parts interleaved in their original order. This prevents
          // stale text (e.g. "please approve…") from appearing as a
          // separate assistant turn after tool results, which would
          // confuse the LLM into re-calling already-executed tools.
          const contentParts: Array<
            | { type: 'text'; text: string }
            | {
                type: 'tool-call';
                toolCallId: string;
                toolName: string;
                input: unknown;
              }
          > = [];

          for (const part of msg.parts) {
            if (part.type === 'text' && part.text) {
              contentParts.push({ type: 'text', text: part.text });
            } else if (part.type === 'tool_use') {
              contentParts.push({
                type: 'tool-call' as const,
                toolCallId: part.id,
                toolName: part.name,
                input: part.input || {},
              });
            }
          }

          if (contentParts.length) {
            coreMessages.push({
              role: 'assistant',
              content: contentParts,
            });
          }

          // Emit tool results for completed tool blocks
          for (const p of toolBlocks) {
            if (p.output !== undefined) {
              coreMessages.push({
                role: 'tool',
                content: [
                  {
                    type: 'tool-result' as const,
                    toolCallId: p.id,
                    toolName: p.name,
                    output: {
                      type: 'text' as const,
                      value:
                        typeof p.output === 'string'
                          ? p.output
                          : JSON.stringify(p.output),
                    },
                  },
                ],
              });
            }
          }
        } else {
          // Fallback: content-only (user messages in old format)
          coreMessages.push({
            role: 'assistant',
            content: msg.content || '',
          });
        }
      }
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

  estimateMessageTokens(msg: ChatMessageType): number {
    if (msg.parts?.length) {
      return msg.parts.reduce((sum, p) => {
        if (p.type === 'text') return sum + this.estimateTokens(p.text);
        return sum + this.estimateTokens(JSON.stringify(p));
      }, 0);
    }
    return this.estimateTokens(msg.content || '');
  }
}
