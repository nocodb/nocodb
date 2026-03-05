import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { stepCountIs, streamText } from 'ai';
import {
  AppEvents,
  ChatMessageRole,
  ChatToolCallStatus,
  EventType,
  extractRolesObj,
  IntegrationCategoryType,
  PlanFeatureTypes,
  ProjectRoles,
} from 'nocodb-sdk';
import { ChatToolRegistry } from '../tools/chat-tool-registry';
import { MAX_STEPS, MESSAGE_MAX_LENGTH } from '../constants';
import { ChatContextService } from './chat-context.service';
import { ChatCompactionService } from './chat-compaction.service';
import type {
  ChatContentBlock,
  ChatEventPayload,
  ChatSendMessageType,
} from 'nocodb-sdk';
import type { ChatApprovalJobData, ChatMessageJobData } from '~/interface/Jobs';
import type { NcContext, NcRequest } from '~/interface/config';
import type { AiIntegration } from '@noco-local-integrations/core';
import ChatSession from '~/models/ChatSession';
import ChatMessage from '~/models/ChatMessage';
import Integration from '~/models/Integration';
import Base from '~/models/Base';
import User from '~/models/User';
import Permission from '~/models/Permission';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { InstanceCommands, JobTypes } from '~/interface/Jobs';
import { NocoJobsService } from '~/services/noco-jobs.service';
import NocoSocket from '~/socket/NocoSocket';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';

interface ChatCallbacks {
  onToken?: (content: string) => void;
  onToolStart?: (ts: { toolCallId: string; toolName: string }) => void;
  onToolCall?: (tc: {
    toolCallId: string;
    toolName: string;
    input: any;
  }) => void;
  onToolResult?: (tr: {
    toolCallId: string;
    toolName: string;
    result: any;
  }) => void;
  onDone?: (params: { messageId: string; parts: ChatContentBlock[] }) => void;
  onError?: (error: string) => void;
}

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);

  // Active abort controllers keyed by sessionId — allows cancelling in-flight LLM streams
  private readonly activeStreams = new Map<string, AbortController>();

  constructor(
    private readonly contextService: ChatContextService,
    private readonly compactionService: ChatCompactionService,
    private readonly toolRegistry: ChatToolRegistry,
    private readonly appHooksService: AppHooksService,
    private readonly jobsService: NocoJobsService,
  ) {}

  // Pending abort ack resolvers keyed by sessionId
  private readonly abortAckResolvers = new Map<string, () => void>();

  onModuleInit() {
    if (!JobsRedis.available) return;

    // Worker side: receive abort command → abort stream → ack back to primary
    JobsRedis.workerCallbacks[InstanceCommands.ABORT_CHAT_STREAM] = async (
      sessionId: string,
    ) => {
      const aborted = this.abortStream(sessionId);
      if (aborted) {
        try {
          await JobsRedis.emitPrimaryCommand(
            InstanceCommands.ABORT_CHAT_STREAM_ACK,
            sessionId,
          );
        } catch (e) {
          this.logger.error(e.message, e.stack);
        }
      }
    };

    // Primary side: receive ack → resolve the pending promise
    JobsRedis.primaryCallbacks[InstanceCommands.ABORT_CHAT_STREAM_ACK] = async (
      sessionId: string,
    ) => {
      const resolve = this.abortAckResolvers.get(sessionId);
      if (resolve) {
        resolve();
        this.abortAckResolvers.delete(sessionId);
      }
    };
  }

  async sessionCreate(
    context: NcContext,
    params: {
      title?: string;
      req: NcRequest;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);

    const session = await ChatSession.insert(context, {
      title: params.title || 'New Chat',
      fk_workspace_id: context.workspace_id,
      fk_user_id: params.req.user?.id,
    });

    this.appHooksService.emit(AppEvents.CHAT_SESSION_CREATE, {
      context,
      req: params.req,
      sessionId: session.id,
    });

    // Broadcast to all connected clients of this user (cross-tab sync).
    // Pass socketId so the sender tab can skip the event (it already has the data).
    this.broadcastToUser(
      params.req.user?.id,
      { action: 'session-create', sessionId: session.id, session },
      params.req.ncSocketId,
    );

    return session;
  }

  async sessionList(
    context: NcContext,
    params: {
      req: NcRequest;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);

    return ChatSession.list(context, {
      workspaceId: context.workspace_id,
      userId: params.req.user?.id,
    });
  }

  async sessionGet(
    context: NcContext,
    params: {
      sessionId: string;
      req: NcRequest;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);

    const session = await ChatSession.get(context, params.sessionId);

    if (!session) {
      NcError.get(context).genericNotFound('Chat session', params.sessionId);
    }

    // Defense-in-depth: verify the session belongs to this workspace.
    // ChatSession.get() looks up by id only (RootScopes.WORKSPACE) — this
    // prevents a guessed session ID from leaking across workspaces.
    if (session.fk_workspace_id !== context.workspace_id) {
      NcError.get(context).genericNotFound('Chat session', params.sessionId);
    }

    // Verify ownership
    if (session.fk_user_id !== params.req.user?.id) {
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

    this.appHooksService.emit(AppEvents.CHAT_SESSION_DELETE, {
      context,
      req: params.req,
      sessionId: session.id,
    });

    this.broadcastToUser(
      params.req.user?.id,
      { action: 'session-delete', sessionId: session.id },
      params.req.ncSocketId,
    );

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
  ): Promise<void> {
    const { sessionId, body, req } = params;

    // 1. Validate message length before any DB or LLM work
    if (!body.content || body.content.length === 0) {
      NcError.get(context).badRequest('Message content cannot be empty');
    }
    if (body.content.length > MESSAGE_MAX_LENGTH) {
      NcError.get(context).badRequest(
        `Message too long (max ${MESSAGE_MAX_LENGTH.toLocaleString()} characters)`,
      );
    }

    // 2. Validate session ownership
    await this.sessionGet(context, { sessionId, req });

    // 3. Check feature gate
    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);

    // 3b. Validate base belongs to this workspace and user has access (if provided)
    const validatedBaseId = await this.validateBaseId(
      context,
      body.base_id,
      req,
    );

    // 4. Persist user message
    const userMessage = await ChatMessage.insert(context, {
      fk_session_id: sessionId,
      fk_workspace_id: context.workspace_id,
      role: ChatMessageRole.USER,
      content: body.content,
    });

    this.broadcastToUser(
      req.user?.id,
      { action: 'user-message', sessionId, message: userMessage },
      req.ncSocketId,
    );

    // 5. Enqueue job — response delivered via Socket.IO
    const chatJobId = `chat:msg:${sessionId}`;

    // Remove any stale job for this session (e.g. previous job failed, user
    // cancelled, or job completed but wasn't cleaned up yet). Without this,
    // Bull silently drops the new job because the jobId already exists.
    await this.removeStaleJob(chatJobId, sessionId);

    const jobData: Omit<ChatMessageJobData, 'jobName'> = {
      context,
      user: req.user,
      sessionId,
      firstUserMessage: body.content,
      approvals: body.approvals || {},
      baseId: validatedBaseId,
    };

    await this.jobsService.add(JobTypes.ChatMessage, jobData, {
      jobId: chatJobId,
      removeOnFail: true,
    });
  }

  async approveToolCalls(
    context: NcContext,
    params: {
      sessionId: string;
      messageId: string;
      decisions: Record<string, 'approved' | 'denied'>;
      baseId?: string;
      req: NcRequest;
    },
  ): Promise<void> {
    const { sessionId, messageId, decisions, baseId, req } = params;

    // Validate decision values — TypeScript types have no runtime enforcement
    for (const [key, value] of Object.entries(decisions)) {
      if (value !== 'approved' && value !== 'denied') {
        NcError.get(context).badRequest(
          `Invalid decision value for tool call ${key}`,
        );
      }
    }

    // Verify session ownership
    await this.sessionGet(context, { sessionId, req });

    // Check feature gate
    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);

    // Validate base belongs to this workspace and user has access (if provided)
    const validatedBaseId = await this.validateBaseId(context, baseId, req);

    // Validate the message belongs to this session (scoped at DB level)
    const msg = await ChatMessage.get(context, messageId, sessionId);
    if (!msg) {
      NcError.get(context).genericNotFound('Chat message', messageId);
    }

    // Don't update the DB here — the job's executeApprovals will set the final
    // status after actually executing the tools. The frontend handles the
    // optimistic UI update (AWAITING_APPROVAL → RUNNING) locally.

    // Enqueue job to execute approved tools and continue the conversation
    const approvalJobId = `chat:approval:${sessionId}:${messageId}`;

    await this.removeStaleJob(approvalJobId, sessionId);

    const jobData: Omit<ChatApprovalJobData, 'jobName'> = {
      context,
      user: req.user,
      sessionId,
      messageId,
      decisions,
      baseId: validatedBaseId,
    };

    await this.jobsService.add(JobTypes.ChatApproval, jobData, {
      jobId: approvalJobId,
      removeOnFail: true,
    });
  }

  /**
   * Abort any in-flight chat job for the given session.
   * Called from the controller when the user clicks "stop".
   */
  async abortSession(
    context: NcContext,
    params: {
      sessionId: string;
      req: NcRequest;
    },
  ): Promise<void> {
    const { sessionId, req } = params;

    // Verify session ownership
    await this.sessionGet(context, { sessionId, req });

    // Abort the in-flight stream (handles both message and approval jobs).
    // removeStaleJob sends an abort signal via Redis PubSub for cross-worker,
    // and aborts locally if the stream is on this process.
    try {
      await this.removeStaleJob(`chat:msg:${sessionId}`, sessionId);
    } catch {
      // Job may not exist — still abort the stream directly
    }

    // Also abort locally in case only an approval job is running
    // (removeStaleJob above targets the message job ID specifically).
    this.abortStream(sessionId);

    // Cross-worker: broadcast abort for approval jobs whose jobId we don't know
    if (JobsRedis.available) {
      try {
        await JobsRedis.emitWorkerCommand(
          InstanceCommands.ABORT_CHAT_STREAM,
          sessionId,
        );
      } catch {
        // best-effort
      }
    }

    // No broadcast needed — the aborted stream's onFinish persists partial
    // content and sends message-done. The calling tab awaits this endpoint
    // and handles cleanup itself; other tabs receive message-done via socket.
  }

  // ---------------------------------------------------------------------------
  // Core LLM turn — called from job processors
  // ---------------------------------------------------------------------------

  async processAgentTurn(
    context: NcContext,
    params: {
      sessionId: string;
      req: NcRequest;
      approvals?: Record<string, 'approved' | 'denied'>;
      firstUserMessage?: string;
      baseId?: string;
    },
    callbacks?: ChatCallbacks,
  ): Promise<void> {
    const { sessionId, req, approvals = {}, firstUserMessage, baseId } = params;

    // Load session (may have been updated since job was queued)
    const session = await ChatSession.get(context, sessionId);
    if (!session) {
      callbacks?.onError?.('Session no longer exists');
      return;
    }

    // Defense-in-depth: re-verify workspace + ownership even though the job
    // was enqueued after an ownership check. Guards against any future code
    // path that bypasses the HTTP-layer validation.
    if (
      session.fk_workspace_id !== context.workspace_id ||
      session.fk_user_id !== req.user?.id
    ) {
      this.logger.warn(
        `processAgentTurn: user ${req.user?.id} does not own session ${sessionId} (owner: ${session.fk_user_id})`,
      );
      callbacks?.onError?.('Session access denied');
      return;
    }

    // Get AI provider
    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      callbacks?.onError?.('No AI integration configured');
      return;
    }

    let wrapper: ReturnType<
      typeof integration.getIntegrationWrapper<AiIntegration>
    >;
    let model: ReturnType<AiIntegration['getModel']>;
    try {
      wrapper = integration.getIntegrationWrapper<AiIntegration>();
      model = wrapper.getModel();
    } catch (e) {
      this.logger.error('Failed to initialise AI provider', e.stack);
      callbacks?.onError?.('Failed to initialise AI provider');
      return;
    }

    // Build a sub-context with base_id so tools and system prompt get schema context
    const toolContext = await this.buildToolContext(context, baseId, req);

    // Build tools
    const availableTools = this.toolRegistry.getAvailableTools(req);
    const vercelTools = this.toolRegistry.toVercelTools(
      availableTools,
      toolContext,
      req,
      approvals,
    );

    // Build system prompt — pass baseId for schema context (may be undefined)
    const userRoles = this.getUserRoles(req);
    const systemPrompt = await this.contextService.buildSystemPrompt(
      toolContext,
      {
        baseId,
        userRoles,
        req,
      },
    );

    // Build messages (with compaction)
    const existingMessages = await ChatMessage.list(context, { sessionId });

    const { summary, activeMessages } =
      await this.compactionService.compactIfNeeded(context, {
        messages: existingMessages,
        existingSummary: session.summary,
      });

    if (summary && summary !== session.summary) {
      await ChatSession.update(context, sessionId, { summary });
    }

    // User message is already in the DB at this point, so use buildHistoryMessages
    // (which treats all messages as history without appending a new user message)
    const coreMessages = this.contextService.buildHistoryMessages({
      messages: activeMessages,
      summary,
    });

    // Build ordered ChatContentBlock[] as streaming arrives.
    // Text blocks accumulate token-by-token; tool_use blocks are inserted inline.
    const contentBlocks: ChatContentBlock[] = [];

    // Abort any previous in-flight stream on this worker, then register ours.
    // Cross-worker abort is handled via Redis PubSub (ABORT_CHAT_STREAM command).
    this.abortStream(sessionId);
    const abortController = new AbortController();
    this.activeStreams.set(sessionId, abortController);

    // Stream the LLM response
    const result = streamText({
      model,
      system: systemPrompt,
      messages: coreMessages,
      tools: vercelTools,
      abortSignal: abortController.signal,
      stopWhen: stepCountIs(MAX_STEPS),
      onChunk: ({ chunk }) => {
        if (abortController.signal.aborted) return;

        if (chunk.type === 'text-delta') {
          const last = contentBlocks[contentBlocks.length - 1];
          if (last && last.type === 'text') {
            // Append to existing text block (avoid many tiny allocations)
            (last as { type: 'text'; text: string }).text += chunk.text;
          } else {
            contentBlocks.push({ type: 'text', text: chunk.text });
          }
          callbacks?.onToken?.(chunk.text);
        }
        if (chunk.type === 'tool-input-start') {
          contentBlocks.push({
            type: 'tool_use',
            id: chunk.id,
            name: chunk.toolName,
            status: ChatToolCallStatus.RUNNING,
          });
          callbacks?.onToolStart?.({
            toolCallId: chunk.id,
            toolName: chunk.toolName,
          });
        }
      },
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (abortController.signal.aborted) return;

        // Update input on matching tool_use blocks
        for (const tc of toolCalls || []) {
          const block = contentBlocks.find(
            (b): b is Extract<ChatContentBlock, { type: 'tool_use' }> =>
              b.type === 'tool_use' && b.id === tc.toolCallId,
          );
          if (block) block.input = tc.input;

          callbacks?.onToolCall?.({
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            input: tc.input,
          });
        }

        // Update output + status on matching tool_use blocks
        for (const tr of toolResults || []) {
          const block = contentBlocks.find(
            (b): b is Extract<ChatContentBlock, { type: 'tool_use' }> =>
              b.type === 'tool_use' && b.id === tr.toolCallId,
          );
          if (block) {
            block.output = tr.output;
            block.is_error = false;
          }

          callbacks?.onToolResult?.({
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            result: tr.output,
          });
        }
      },
      onFinish: async ({ usage, steps }) => {
        // Skip if aborted — partial content is persisted in the catch block below
        if (abortController.signal.aborted) return;

        try {
          // Resolve final status for each tool_use block from step results
          for (const step of steps || []) {
            for (const tr of step.toolResults || []) {
              const raw = tr.output;
              const block = contentBlocks.find(
                (b): b is Extract<ChatContentBlock, { type: 'tool_use' }> =>
                  b.type === 'tool_use' && b.id === tr.toolCallId,
              );
              if (!block) continue;

              let status: ChatToolCallStatus;
              if (typeof raw === 'string') {
                try {
                  const parsed = JSON.parse(raw);
                  if (parsed.__requires_approval) {
                    status = ChatToolCallStatus.AWAITING_APPROVAL;
                  } else if (parsed.__requires_user_input) {
                    status = ChatToolCallStatus.AWAITING_INPUT;
                  } else if (parsed.status === 'denied') {
                    status = ChatToolCallStatus.DENIED;
                  } else {
                    status = ChatToolCallStatus.SUCCESS;
                  }
                } catch {
                  status = ChatToolCallStatus.SUCCESS;
                }
              } else if (
                raw &&
                typeof raw === 'object' &&
                raw.__requires_user_input
              ) {
                status = ChatToolCallStatus.AWAITING_INPUT;
              } else {
                status = ChatToolCallStatus.SUCCESS;
              }
              block.status = status;
            }

            // Tool calls with no result yet → SUCCESS (Vercel AI SDK resolved them)
            for (const tc of step.toolCalls || []) {
              const block = contentBlocks.find(
                (b): b is Extract<ChatContentBlock, { type: 'tool_use' }> =>
                  b.type === 'tool_use' && b.id === tc.toolCallId,
              );
              if (block && block.status === ChatToolCallStatus.RUNNING) {
                block.status = ChatToolCallStatus.SUCCESS;
              }
            }
          }

          // Remove trailing empty text blocks
          while (
            contentBlocks.length > 0 &&
            contentBlocks[contentBlocks.length - 1].type === 'text' &&
            !(
              contentBlocks[contentBlocks.length - 1] as {
                type: 'text';
                text: string;
              }
            ).text
          ) {
            contentBlocks.pop();
          }

          const assistantMessage = await ChatMessage.insert(context, {
            fk_session_id: sessionId,
            fk_workspace_id: context.workspace_id,
            role: ChatMessageRole.ASSISTANT,
            parts: contentBlocks,
            model: 'unknown',
            input_tokens: usage?.inputTokens || 0,
            output_tokens: usage?.outputTokens || 0,
          });

          // Atomic increment to avoid stale-read race when turns overlap
          let autoTitle: string | undefined;
          if ((session.message_count || 0) === 0 && firstUserMessage) {
            autoTitle =
              firstUserMessage.length > 50
                ? firstUserMessage.slice(0, 47) + '...'
                : firstUserMessage;
          }

          await ChatSession.incrementTokens(context, sessionId, {
            inputTokens: usage?.inputTokens || 0,
            outputTokens: usage?.outputTokens || 0,
            title: autoTitle,
          });

          await integration.storeInsert(context, req.user?.id, usage);

          callbacks?.onDone?.({
            messageId: assistantMessage.id,
            parts: contentBlocks,
          });
        } catch (e) {
          this.logger.error('Failed to persist chat response', e.stack);
          callbacks?.onError?.('Failed to persist response');
        }
      },
    });

    // Consume the stream and await onFinish (SDK awaits it internally)
    try {
      await result.text;
    } catch (e) {
      if (abortController.signal.aborted) {
        this.logger.log(`Chat stream aborted for session ${sessionId}`);

        // Persist partial content so the conversation history is consistent.
        // Mark any still-RUNNING tool_use blocks as ERROR (cancelled).
        for (const block of contentBlocks) {
          if (
            block.type === 'tool_use' &&
            block.status === ChatToolCallStatus.RUNNING
          ) {
            block.status = ChatToolCallStatus.ERROR;
          }
        }

        // Remove trailing empty text blocks
        while (
          contentBlocks.length > 0 &&
          contentBlocks[contentBlocks.length - 1].type === 'text' &&
          !(
            contentBlocks[contentBlocks.length - 1] as {
              type: 'text';
              text: string;
            }
          ).text
        ) {
          contentBlocks.pop();
        }

        if (contentBlocks.length > 0) {
          try {
            const partialMessage = await ChatMessage.insert(context, {
              fk_session_id: sessionId,
              fk_workspace_id: context.workspace_id,
              role: ChatMessageRole.ASSISTANT,
              parts: contentBlocks,
              model: 'unknown',
              input_tokens: 0,
              output_tokens: 0,
            });

            callbacks?.onDone?.({
              messageId: partialMessage.id,
              parts: contentBlocks,
            });
          } catch (persistErr) {
            this.logger.error(
              'Failed to persist partial chat response',
              persistErr.stack,
            );
          }
        }
      } else {
        this.logger.error('Error consuming chat stream', e.stack);
        callbacks?.onError?.('Stream error');
      }
    } finally {
      // Clean up only if this is still the active controller (not superseded)
      if (this.activeStreams.get(sessionId) === abortController) {
        this.activeStreams.delete(sessionId);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Tool approval execution — called from ChatApprovalProcessor
  // ---------------------------------------------------------------------------

  async executeApprovals(
    context: NcContext,
    params: {
      sessionId: string;
      messageId: string;
      decisions: Record<string, 'approved' | 'denied'>;
      baseId?: string;
      req: NcRequest;
    },
  ): Promise<ChatContentBlock[] | null> {
    const { sessionId, messageId, decisions, baseId, req } = params;

    const session = await ChatSession.get(context, sessionId);
    if (
      !session ||
      session.fk_workspace_id !== context.workspace_id ||
      session.fk_user_id !== req.user?.id
    ) {
      return null;
    }

    const msg = await ChatMessage.get(context, messageId, sessionId);
    if (!msg) return null;

    // Build a sub-context with base_id so tools execute within the correct base
    const toolContext = await this.buildToolContext(context, baseId, req);

    // Build updated parts: execute approved tools inline, record denials
    const updatedParts: ChatContentBlock[] = [];

    for (const p of msg.parts || []) {
      if (
        p.type !== 'tool_use' ||
        p.status !== ChatToolCallStatus.AWAITING_APPROVAL
      ) {
        updatedParts.push(p);
        continue;
      }

      const decision = decisions[p.id];

      if (decision === 'approved') {
        const { result, isError } = await this.toolRegistry.executeTool(
          toolContext,
          p.name,
          p.input || {},
          req,
        );
        updatedParts.push({
          ...p,
          status: isError
            ? ChatToolCallStatus.ERROR
            : ChatToolCallStatus.SUCCESS,
          output: isError
            ? `ERROR: ${result}`
            : typeof result === 'string'
            ? result
            : JSON.stringify(result, null, 2),
          is_error: isError,
        });
      } else if (decision === 'denied') {
        updatedParts.push({
          ...p,
          status: ChatToolCallStatus.DENIED,
          output: 'Operation denied by user.',
          is_error: false,
        });
      } else {
        updatedParts.push(p);
      }
    }

    await ChatMessage.update(context, messageId, { parts: updatedParts });

    return updatedParts;
  }

  // ---------------------------------------------------------------------------
  // Socket.IO broadcast helpers
  // ---------------------------------------------------------------------------

  buildSocketCallbacks(
    userId: string,
    sessionId: string,
    workspaceId: string,
    logger: { error: (msg: string) => void },
  ): ChatCallbacks {
    const broadcast = (
      payload: Omit<ChatEventPayload, 'sessionId' | 'timestamp'>,
    ) => {
      NocoSocket.broadcastEventToUser(userId, {
        event: EventType.CHAT_EVENT,
        payload: { ...payload, sessionId },
      });
    };

    return {
      onToken: (content) => broadcast({ action: 'token', content }),
      onToolStart: (ts) =>
        broadcast({
          action: 'tool-start',
          toolCallId: ts.toolCallId,
          name: ts.toolName,
        }),
      onToolCall: (tc) =>
        broadcast({
          action: 'tool-call',
          toolCallId: tc.toolCallId,
          name: tc.toolName,
          args: tc.input,
        }),
      onToolResult: (tr) =>
        broadcast({
          action: 'tool-result',
          toolCallId: tr.toolCallId,
          output: tr.result,
          isError: false,
        }),
      onDone: ({ messageId, parts }) =>
        broadcast({ action: 'message-done', workspaceId, messageId, parts }),
      onError: (error) => {
        logger.error(`Chat failed for session ${sessionId}: ${error}`);
        broadcast({ action: 'error', error });
      },
    };
  }

  /**
   * Validates that the optional baseId belongs to the current workspace
   * and the requesting user has at least viewer access to it.
   * Returns the verified baseId or undefined if not provided.
   */
  private async validateBaseId(
    context: NcContext,
    baseId: string | undefined,
    req: NcRequest,
  ): Promise<string | undefined> {
    if (!baseId) return undefined;

    const base = await Base.get(context, baseId);
    if (!base) {
      NcError.get(context).genericNotFound('Base', baseId);
    }

    if (base.fk_workspace_id !== context.workspace_id) {
      NcError.get(context).badRequest('Base does not belong to this workspace');
    }

    // Verify the user has at least viewer access to this base
    const userWithRoles = await User.getWithRoles(
      { ...context, base_id: baseId },
      req.user.id,
      { baseId, workspaceId: context.workspace_id },
    );

    const baseRoles = extractRolesObj(userWithRoles.base_roles);
    if (
      !baseRoles ||
      baseRoles[ProjectRoles.NO_ACCESS] ||
      !Object.values(baseRoles).some(Boolean)
    ) {
      NcError.get(context).genericNotFound('Base', baseId);
    }

    return baseId;
  }

  /**
   * Builds a tool-execution context: extends the workspace context with
   * base_id (if provided) and resolves the user's base_roles on req.
   * Job context only carries workspace roles — downstream services and
   * tool permission checks need base-level roles.
   */
  private async buildToolContext(
    context: NcContext,
    baseId: string | undefined,
    req: NcRequest,
  ): Promise<NcContext> {
    const toolContext = baseId ? { ...context, base_id: baseId } : context;

    if (baseId && !req.user.base_roles) {
      const userWithRoles = await User.getWithRoles(toolContext, req.user.id, {
        baseId,
        workspaceId: context.workspace_id,
      });
      req.user.base_roles = userWithRoles.base_roles;
    }

    // Replicate middleware context flags that services rely on.
    // Chat tools bypass the HTTP middleware pipeline, so compute them here.
    if (baseId) {
      const base = await Base.get(toolContext, baseId);
      if (base) {
        // schema_locked — blocks mutating tools when managed app has no draft
        await Base.populateManagedAppInfo(base);
        toolContext.schema_locked = !!(
          base.managed_app_schema_locked || base.is_sandbox_master
        );
      }

      // permissions — needed for table visibility checks inside services
      toolContext.permissions = await Permission.list(toolContext, baseId);
    }

    return toolContext;
  }

  private getUserRoles(req: NcRequest): {
    workspaceRole: string;
    baseRole: string | null;
  } {
    const wsRoles = extractRolesObj(req.user?.workspace_roles) ?? {};
    const baseRoles = extractRolesObj(req.user?.base_roles) ?? {};

    const workspaceRole = Object.keys(wsRoles).find((r) => wsRoles[r]);
    if (!workspaceRole) {
      NcError.unauthorized('No workspace role found');
    }

    return {
      workspaceRole,
      baseRole: Object.keys(baseRoles).find((r) => baseRoles[r]) ?? null,
    };
  }

  /**
   * Abort any in-flight LLM stream for the given session (local process).
   * Called directly on the worker that owns the stream.
   * @returns true if a stream was actually aborted
   */
  private abortStream(sessionId: string): boolean {
    const controller = this.activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Remove a stale Bull job so the jobId slot can be reused.
   * For active jobs: broadcasts an abort signal via Redis PubSub, waits for
   * an ack from the worker (up to 5 s), then force-fails the job to free
   * the jobId slot. Falls back to optimistic force-fail on timeout.
   */
  private async removeStaleJob(
    jobId: string,
    sessionId: string,
  ): Promise<void> {
    try {
      const job = await this.jobsService.getJob(jobId);
      if (!job) return;

      const state = await job.getState();
      if (state === 'active') {
        if (JobsRedis.available) {
          // Wait for ack from worker with 5s timeout
          const ackPromise = new Promise<void>((resolve) => {
            this.abortAckResolvers.set(sessionId, resolve);
          });

          let timer: ReturnType<typeof setTimeout>;
          const timeout = new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 5_000);
          });

          await JobsRedis.emitWorkerCommand(
            InstanceCommands.ABORT_CHAT_STREAM,
            sessionId,
          );

          await Promise.race([ackPromise, timeout]);

          clearTimeout(timer!);
        }

        await job.moveToFailed({ message: 'superseded' }, true);
      } else {
        await job.remove();
      }
    } catch {
      // Job already removed or in a transient state — safe to ignore
    } finally {
      this.abortAckResolvers.delete(sessionId);
    }
  }

  private broadcastToUser(
    userId: string,
    payload: Omit<ChatEventPayload, 'event' | 'timestamp' | 'socketId'>,
    socketId?: string,
  ) {
    if (!userId) return;
    NocoSocket.broadcastEventToUser(
      userId,
      {
        event: EventType.CHAT_EVENT,
        payload,
      },
      socketId,
    );
  }
}
