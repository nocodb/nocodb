import { Injectable, Logger } from '@nestjs/common';
import { stepCountIs, streamText } from 'ai';
import {
  AppEvents,
  ChatMessageRole,
  ChatToolCallStatus,
  IntegrationCategoryType,
} from 'nocodb-sdk';
import { ChatToolRegistry } from '../tools/chat-tool-registry';
import { ChatContextService } from './chat-context.service';
import { ChatCompactionService } from './chat-compaction.service';
import { ChatLimitsService } from './chat-limits.service';
import type { ChatSendMessageType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { AiIntegration } from '@noco-local-integrations/core';
import ChatSession from '~/models/ChatSession';
import ChatMessage from '~/models/ChatMessage';
import Integration from '~/models/Integration';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

const MAX_STEPS = 10;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly contextService: ChatContextService,
    private readonly compactionService: ChatCompactionService,
    private readonly limitsService: ChatLimitsService,
    private readonly toolRegistry: ChatToolRegistry,
    private readonly appHooksService: AppHooksService,
  ) {}

  async sessionCreate(
    context: NcContext,
    params: {
      title?: string;
      req: NcRequest;
    },
  ) {
    const session = await ChatSession.insert(context, {
      title: params.title || 'New Chat',
      fk_workspace_id: context.workspace_id,
      fk_user_id: (params.req as any).user?.id,
    });

    (this.appHooksService as any).emit(AppEvents.CHAT_SESSION_CREATE, {
      context,
      req: params.req,
      sessionId: session.id,
    });

    return session;
  }

  async sessionList(
    context: NcContext,
    params: {
      req: NcRequest;
    },
  ) {
    return ChatSession.list(context, {
      baseId: context.base_id,
      userId: (params.req as any).user?.id,
    });
  }

  async sessionGet(
    context: NcContext,
    params: {
      sessionId: string;
      req: NcRequest;
    },
  ) {
    const session = await ChatSession.get(context, params.sessionId);

    if (!session) {
      NcError.get(context).genericNotFound('Chat session', params.sessionId);
    }

    // Verify ownership
    if (session.fk_user_id !== (params.req as any).user?.id) {
      NcError.get(context).genericNotFound('Chat session', params.sessionId);
    }

    return session;
  }

  async sessionDelete(
    context: NcContext,
    params: {
      sessionId: string;
      req: NcRequest;
    },
  ) {
    const session = await this.sessionGet(context, params);

    await ChatSession.delete(context, params.sessionId);

    (this.appHooksService as any).emit(AppEvents.CHAT_SESSION_DELETE, {
      context,
      req: params.req,
      sessionId: session.id,
    });

    return true;
  }

  async messageList(
    context: NcContext,
    params: {
      sessionId: string;
      limit?: number;
      offset?: number;
      req: NcRequest;
    },
  ) {
    // Verify session ownership
    await this.sessionGet(context, {
      sessionId: params.sessionId,
      req: params.req,
    });

    return ChatMessage.list(context, {
      sessionId: params.sessionId,
      limit: params.limit,
      offset: params.offset,
    });
  }

  async sendMessage(
    context: NcContext,
    params: {
      sessionId: string;
      body: ChatSendMessageType;
      req: NcRequest;
    },
  ): Promise<ReadableStream> {
    const { sessionId, body, req } = params;

    // 1. Validate message length before any DB or LLM work
    if (!body.content || body.content.length === 0) {
      NcError.get(context).badRequest('Message content cannot be empty');
    }
    if (body.content.length > 10_000) {
      NcError.get(context).badRequest(
        'Message too long (max 10,000 characters)',
      );
    }

    // 2. Validate session ownership
    const session = await this.sessionGet(context, { sessionId, req });

    // 3. Check limits
    await this.limitsService.checkCanSendMessage(context, {
      userId: (req as any).user?.id,
    });

    // 4. Persist user message
    await ChatMessage.insert(context, {
      fk_session_id: sessionId,
      fk_workspace_id: context.workspace_id,
      role: ChatMessageRole.USER,
      content: body.content,
    });

    // 5. Get AI provider
    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      NcError.get(context).integrationNotFound('AI');
    }

    const wrapper = integration.getIntegrationWrapper<AiIntegration>();
    const model = wrapper.getModel();

    // 6. Get available tools
    const approvals = body.approvals || {};
    const availableTools = this.toolRegistry.getAvailableTools(req);
    const vercelTools = this.toolRegistry.toVercelTools(
      availableTools,
      context,
      req,
      approvals,
    );

    // 7. Build system prompt (returns cached static block + dynamic block)
    const userRole = this.getUserRole(req);
    const systemPrompt = await this.contextService.buildSystemPrompt(context, {
      baseId: context.base_id,
      tableId: body.context?.table_id,
      viewId: body.context?.view_id,
      userRole,
      req,
    });

    // 8. Build messages (with compaction)
    const existingMessages = await ChatMessage.list(context, { sessionId });

    const { summary, activeMessages } =
      await this.compactionService.compactIfNeeded(context, {
        messages: existingMessages,
        existingSummary: session.summary,
      });

    // Store updated summary if changed
    if (summary && summary !== session.summary) {
      await ChatSession.update(context, sessionId, { summary });
    }

    const coreMessages = this.contextService.buildMessages({
      messages: activeMessages,
      newUserMessage: body.content,
      summary,
    });

    // 8. Stream response
    const result = streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      tools: vercelTools,
      stopWhen: stepCountIs(MAX_STEPS),
      onFinish: async ({ text, usage, steps }) => {
        try {
          // Persist assistant message(s)
          const toolCalls = [];
          const toolResults = [];

          // Build a map of toolCallId → output to detect sentinel values
          const awaitingApprovalIds = new Set<string>();
          const awaitingInputIds = new Set<string>();
          const deniedIds = new Set<string>();

          for (const step of steps || []) {
            if (step.toolResults?.length) {
              for (const tr of step.toolResults) {
                const raw = (tr as any).output;
                if (typeof raw === 'string') {
                  try {
                    const parsed = JSON.parse(raw);
                    if (parsed.__requires_approval) {
                      awaitingApprovalIds.add(tr.toolCallId);
                    } else if (parsed.__requires_user_input) {
                      awaitingInputIds.add(tr.toolCallId);
                    } else if (parsed.status === 'denied') {
                      deniedIds.add(tr.toolCallId);
                    }
                  } catch {
                    // Not JSON — plain string result
                  }
                } else if (
                  raw &&
                  typeof raw === 'object' &&
                  raw.__requires_user_input
                ) {
                  awaitingInputIds.add(tr.toolCallId);
                }
                toolResults.push({
                  tool_call_id: tr.toolCallId,
                  output: (tr as any).output,
                  is_error: false,
                });
              }
            }
          }

          for (const step of steps || []) {
            if (step.toolCalls?.length) {
              for (const tc of step.toolCalls) {
                let status: ChatToolCallStatus;
                if (awaitingApprovalIds.has(tc.toolCallId)) {
                  status = ChatToolCallStatus.AWAITING_APPROVAL;
                } else if (awaitingInputIds.has(tc.toolCallId)) {
                  status = ChatToolCallStatus.AWAITING_INPUT;
                } else if (deniedIds.has(tc.toolCallId)) {
                  status = ChatToolCallStatus.DENIED;
                } else {
                  status = ChatToolCallStatus.SUCCESS;
                }
                toolCalls.push({
                  id: tc.toolCallId,
                  name: tc.toolName,
                  arguments: (tc as any).input,
                  status,
                });
              }
            }
          }

          await ChatMessage.insert(context, {
            fk_session_id: sessionId,
            fk_workspace_id: context.workspace_id,
            role: ChatMessageRole.ASSISTANT,
            content: text,
            tool_calls: toolCalls.length ? toolCalls : undefined,
            tool_results: toolResults.length ? toolResults : undefined,
            model: 'unknown',
            input_tokens: usage?.inputTokens || 0,
            output_tokens: usage?.outputTokens || 0,
          });

          // Update session totals
          await ChatSession.update(context, sessionId, {
            total_input_tokens:
              (session.total_input_tokens || 0) + (usage?.inputTokens || 0),
            total_output_tokens:
              (session.total_output_tokens || 0) + (usage?.outputTokens || 0),
            message_count: (session.message_count || 0) + 2, // user + assistant
          });

          // Auto-generate title on first exchange
          if ((session.message_count || 0) === 0 && text) {
            const title =
              body.content.length > 50
                ? body.content.slice(0, 47) + '...'
                : body.content;
            await ChatSession.update(context, sessionId, { title });
          }

          // Store integration usage
          await integration.storeInsert(
            context,
            (req as any).user?.id,
            usage as any,
          );
        } catch (e) {
          this.logger.error('Failed to persist chat response', e.stack);
        }
      },
    });

    return result.toTextStreamResponse().body;
  }

  async approveToolCalls(
    context: NcContext,
    params: {
      sessionId: string;
      messageId: string;
      decisions: Record<string, 'approved' | 'denied'>;
      req: NcRequest;
    },
  ): Promise<any[]> {
    const { sessionId, messageId, decisions, req } = params;

    // Verify session ownership
    const session = await this.sessionGet(context, { sessionId, req });

    // Load the message with awaiting_approval tool calls
    const message = await ChatMessage.get(context, messageId);
    if (!message) {
      NcError.get(context).genericNotFound('Chat message', messageId);
    }

    // Execute approved tools directly; record denied tools
    const newToolResults: Array<{
      tool_call_id: string;
      output: any;
      is_error: boolean;
    }> = [];

    const updatedToolCalls = (message.tool_calls || []).map((tc) => {
      if (tc.status !== ChatToolCallStatus.AWAITING_APPROVAL) return tc;
      const decision = decisions[tc.id];
      if (decision === 'approved')
        return { ...tc, status: ChatToolCallStatus.SUCCESS };
      if (decision === 'denied')
        return { ...tc, status: ChatToolCallStatus.DENIED };
      return tc;
    });

    for (const tc of message.tool_calls || []) {
      if (tc.status !== ChatToolCallStatus.AWAITING_APPROVAL) continue;
      const decision = decisions[tc.id];

      if (decision === 'approved') {
        const { result, isError } = await this.toolRegistry.executeTool(
          context,
          tc.name,
          tc.arguments,
          req,
        );
        newToolResults.push({
          tool_call_id: tc.id,
          output: isError
            ? `ERROR: ${result}`
            : typeof result === 'string'
            ? result
            : JSON.stringify(result, null, 2),
          is_error: isError,
        });
      } else if (decision === 'denied') {
        newToolResults.push({
          tool_call_id: tc.id,
          output: 'Operation denied by user.',
          is_error: false,
        });
      }
    }

    // Replace __requires_approval synthetic results with real results.
    // Appending would cause duplicate tool_call_id entries in history,
    // confusing the LLM with two results for the same tool call.
    const actedOnIds = new Set(Object.keys(decisions));
    const keptResults = (message.tool_results || []).filter(
      (tr) => !actedOnIds.has(tr.tool_call_id),
    );

    await ChatMessage.update(context, messageId, {
      tool_calls: updatedToolCalls,
      tool_results: [...keptResults, ...newToolResults],
    });

    // Continue the LLM conversation so it can respond to the tool results
    await this.continueAfterApproval(context, { session, sessionId, req });

    return this.messageList(context, { sessionId, req });
  }

  private async continueAfterApproval(
    context: NcContext,
    params: {
      session: any;
      sessionId: string;
      req: NcRequest;
    },
  ): Promise<void> {
    const { session, sessionId, req } = params;

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );
    if (!integration) return;

    const wrapper = integration.getIntegrationWrapper<AiIntegration>();
    const model = wrapper.getModel();

    const availableTools = this.toolRegistry.getAvailableTools(req);
    // No pending approvals for continuation — all tools can execute freely
    const vercelTools = this.toolRegistry.toVercelTools(
      availableTools,
      context,
      req,
      {},
    );

    const userRole = this.getUserRole(req);
    const systemPrompt = await this.contextService.buildSystemPrompt(context, {
      baseId: context.base_id,
      userRole,
      req,
    });

    const allMessages = await ChatMessage.list(context, { sessionId });
    const coreMessages = this.contextService.buildHistoryMessages({
      messages: allMessages,
      summary: session.summary,
    });

    const result = streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      tools: vercelTools,
      stopWhen: stepCountIs(MAX_STEPS),
      onFinish: async ({ text, usage, steps }) => {
        try {
          const toolCalls = [];
          const toolResults = [];

          for (const step of steps || []) {
            if (step.toolResults?.length) {
              for (const tr of step.toolResults) {
                toolResults.push({
                  tool_call_id: tr.toolCallId,
                  output: (tr as any).output,
                  is_error: false,
                });
              }
            }
            if (step.toolCalls?.length) {
              for (const tc of step.toolCalls) {
                toolCalls.push({
                  id: tc.toolCallId,
                  name: tc.toolName,
                  arguments: (tc as any).input,
                  status: ChatToolCallStatus.SUCCESS,
                });
              }
            }
          }

          await ChatMessage.insert(context, {
            fk_session_id: sessionId,
            fk_workspace_id: context.workspace_id,
            role: ChatMessageRole.ASSISTANT,
            content: text,
            tool_calls: toolCalls.length ? toolCalls : undefined,
            tool_results: toolResults.length ? toolResults : undefined,
            model: 'unknown',
            input_tokens: usage?.inputTokens || 0,
            output_tokens: usage?.outputTokens || 0,
          });

          await ChatSession.update(context, sessionId, {
            total_input_tokens:
              (session.total_input_tokens || 0) + (usage?.inputTokens || 0),
            total_output_tokens:
              (session.total_output_tokens || 0) + (usage?.outputTokens || 0),
            message_count: (session.message_count || 0) + 1,
          });

          await integration.storeInsert(
            context,
            (req as any).user?.id,
            usage as any,
          );
        } catch (e) {
          this.logger.error('Failed to persist continuation response', e.stack);
        }
      },
    });

    // Consume stream
    const reader = result.toTextStreamResponse().body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  }

  private getUserRole(req: NcRequest): string {
    const roles = (req as any).user?.base_roles || (req as any).user?.roles;
    if (!roles) return 'viewer';

    if (typeof roles === 'string') return roles;

    // Find highest role
    for (const role of ['owner', 'creator', 'editor', 'commenter', 'viewer']) {
      if (roles[role]) return role;
    }
    return 'viewer';
  }
}
