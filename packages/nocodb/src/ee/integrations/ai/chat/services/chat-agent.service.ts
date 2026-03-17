/**
 * Chat Agent Service — unified entry point for multi-agent chat turns.
 *
 * Merges the orchestrator loop (router → specialist → router) with the
 * turn lifecycle (validation, context building, compaction, persistence,
 * title generation, follow-ups).
 *
 * Job processors call this service directly:
 *   - ChatMessageProcessor  → executeTurn()
 *   - ChatApprovalProcessor → executeApprovals() + executeTurn()
 */

import { Injectable, Logger } from '@nestjs/common';
import { stepCountIs, tool } from 'ai';
import { z } from 'zod';
import {
  ChatEventAction,
  ChatMessageRole,
  ChatToolCallStatus,
  EventType,
  extractRolesObj,
  IntegrationCategoryType,
} from 'nocodb-sdk';
import type {
  AgentDefinition,
  RouterPromptParams,
  SpecialistPromptParams,
} from '~/integrations/ai/chat/agents';
import type { ChatContentBlock, ChatEventPayload } from 'nocodb-sdk';
import type { ToolSet } from 'ai';
import type { NcContext, NcRequest } from '~/interface/config';
import type { AiIntegration } from '@noco-local-integrations/core';
import { chatAi, chatTraced } from '~/integrations/ai/chat/braintrust.init';
import { AGENTS, SPECIALIST_NAMES } from '~/integrations/ai/chat/agents';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { MAX_ROUNDS, ROUTER_MAX_TURNS } from '~/integrations/ai/chat/constants';
import {
  buildTitleGenerationMessages,
  TITLE_GENERATION_SYSTEM_PROMPT,
} from '~/integrations/ai/chat/prompts/suggestions';
import {
  buildSummarizePrompt,
  type SummarizePromptParams,
} from '~/integrations/ai/chat/prompts/summarize';
import { ChatToolRegistry } from '~/integrations/ai/chat/tools/chat-tool-registry';
import { ChatSessionService } from '~/integrations/ai/chat/services/chat-session.service';
import { ChatContextService } from '~/integrations/ai/chat/services/chat-context.service';
import { ChatCompactionService } from '~/integrations/ai/chat/services/chat-compaction.service';
import { ChatSuggestionsService } from '~/integrations/ai/chat/services/chat-suggestions.service';
import ChatSession from '~/models/ChatSession';
import ChatMessage from '~/models/ChatMessage';
import Integration from '~/models/Integration';
import Base from '~/models/Base';
import User from '~/models/User';
import { NcError } from '~/helpers/catchError';
import NocoSocket from '~/socket/NocoSocket';

export interface ChatCallbacks {
  onToken?: (content: string) => void;
  onToolStart?: (ts: {
    toolCallId: string;
    toolName: string;
    agent?: string;
    visibility?: string;
  }) => void;
  onToolCall?: (tc: {
    toolCallId: string;
    toolName: string;
    input: any;
    agent?: string;
    visibility?: string;
  }) => void;
  onToolResult?: (tr: {
    toolCallId: string;
    toolName: string;
    result: any;
    agent?: string;
    visibility?: string;
  }) => void;
  onAgentSwitch?: (params: { agent: string; label?: string }) => void;
  onDone?: (params: {
    messageId: string;
    parts: ChatContentBlock[];
    btSpanId?: string | null;
  }) => void;
  onFollowUps?: (params: { messageId: string; followUps: string[] }) => void;
  onError?: (error: string) => void;
}

interface TurnSummary {
  agent: string;
  summary: string;
  completed: string[];
  remaining: string[];
}

@Injectable()
export class ChatAgentService {
  private readonly logger = new Logger(ChatAgentService.name);

  /** Active LLM streams indexed by sessionId — for abort support. */
  private readonly activeStreams = new Map<string, AbortController>();

  constructor(
    private readonly sessionService: ChatSessionService,
    private readonly contextService: ChatContextService,
    private readonly compactionService: ChatCompactionService,
    private readonly toolRegistry: ChatToolRegistry,
    private readonly suggestionsService: ChatSuggestionsService,
  ) {}

  /**
   * Execute a full multi-agent turn:
   * validate → build context → run agent loop → persist → title → follow-ups.
   */
  async executeTurn(
    context: NcContext,
    params: {
      sessionId: string;
      req: NcRequest;
      approvals?: Record<string, 'approved' | 'denied'>;
      firstUserMessage?: string;
    },
    callbacks?: ChatCallbacks,
  ): Promise<void> {
    const { sessionId, req, approvals = {}, firstUserMessage } = params;

    const session = await ChatSession.get(context, sessionId);
    if (!session) {
      callbacks?.onError?.('Session no longer exists');
      return;
    }

    if (
      session.fk_workspace_id !== context.workspace_id ||
      session.fk_user_id !== req.user?.id
    ) {
      this.logger.warn(
        `executeTurn: user ${req.user?.id} does not own session ${sessionId} (owner: ${session.fk_user_id})`,
      );
      callbacks?.onError?.('Session access denied');
      return;
    }

    const baseId = session.base_id;

    // ── 2. Get AI provider ──────────────────────────────────────────────
    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      callbacks?.onError?.('No AI integration configured');
      return;
    }

    let aiWrapper: AiIntegration;
    try {
      aiWrapper = integration.getIntegrationWrapper<AiIntegration>();
    } catch (e) {
      this.logger.error('Failed to initialise AI provider', e.stack);
      callbacks?.onError?.('Failed to initialise AI provider');
      return;
    }

    const supportsModelTiers = (integration.sub_type as string) === 'nocodb';

    const getModelForTier = (tier: string) =>
      aiWrapper.getModel(
        supportsModelTiers ? { customModel: tier } : undefined,
      );

    // Default model — used for compaction, title generation, and as fallback
    const model = getModelForTier('high');

    // Fire-and-forget title generation for first message
    const isFirstMessage =
      (session.message_count || 0) === 0 && firstUserMessage;
    if (isFirstMessage) {
      this.generateSessionTitle(model, firstUserMessage, sessionId)
        .then(async (title) => {
          if (!title) return;
          await ChatSession.update(context, sessionId, { title });
          const updated = await ChatSession.get(context, sessionId);
          this.sessionService.broadcastToUser(req.user?.id, {
            action: ChatEventAction.SESSION_UPDATE,
            sessionId,
            session: updated,
          });
        })
        .catch((e) => {
          this.logger.warn('Failed to generate session title', e.message);
        });
    }

    const toolContext = await this.buildToolContext(context, req);

    const existingMessages = await ChatMessage.list(context, { sessionId });

    // Collect files from all session messages for sandbox tool access
    const sessionFiles = existingMessages.flatMap((m) => m.files || []);
    if (sessionFiles.length) {
      (req as any).__sessionFiles = sessionFiles;
    }

    const { summary, activeMessages } =
      await this.compactionService.compactIfNeeded(context, {
        messages: existingMessages,
        existingSummary: session.summary,
        modelId: model.modelId,
      });

    if (summary && summary !== session.summary) {
      await ChatSession.update(context, sessionId, { summary });
    }

    const userRoles = this.getUserRoles(req);

    const coreMessages = this.contextService.buildHistoryMessages({
      messages: activeMessages,
    });

    let baseName: string | undefined;
    if (baseId) {
      const base = await Base.get(toolContext, baseId);
      baseName = base?.title;
    }

    // ── 4. Abort management ─────────────────────────────────────────────
    this.abortStream(sessionId);
    const abortController = new AbortController();
    this.activeStreams.set(sessionId, abortController);

    try {
      await chatTraced(
        `turn:${sessionId}`,
        async (span) => {
          span?.log({
            input: { userMessage: firstUserMessage },
            metadata: {
              sessionId,
              workspaceId: context.workspace_id,
              baseId,
              userId: req.user?.id,
            },
            tags: ['chat', 'turn'],
          });

          // ── 5. Run multi-agent loop ─────────────────────────────────────────
          const contentBlocks: ChatContentBlock[] = [];
          const agentHistory: string[] = [];
          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          let currentAgent = 'router';
          let routerInstruction: string | undefined;
          let specialistRan = false;

          const turnSummaries: TurnSummary[] = [
            ...(session?.meta?.turnSummaries || []),
          ];

          for (let round = 0; round < MAX_ROUNDS; round++) {
            if (abortController.signal.aborted) break;

            if (this.detectLoop(agentHistory)) {
              this.logger.warn(
                `Loop detected in session ${sessionId}: ${agentHistory.join(
                  ' → ',
                )}`,
              );
              break;
            }

            agentHistory.push(currentAgent);

            if (currentAgent === 'router') {
              // ─── Router Phase ────────────────────────────────────────────
              callbacks?.onAgentSwitch?.({
                agent: 'router',
              });

              const decision = await this.runRouter({
                model: getModelForTier(AGENTS.router.modelTier),
                context: toolContext,
                baseId,
                baseName,
                sessionId,
                userRoles,
                messages: coreMessages,
                newUserMessage: firstUserMessage || '',
                turnSummaries,
                agentHistory,
                req,
                abortSignal: abortController.signal,
              });

              totalInputTokens += decision.inputTokens;
              totalOutputTokens += decision.outputTokens;

              if (decision.type === 'route') {
                currentAgent = decision.agent;
                routerInstruction = decision.instruction;
              } else if (decision.type === 'respond') {
                if (decision.text) {
                  contentBlocks.push({ type: 'text', text: decision.text });
                  callbacks?.onToken?.(decision.text);
                }
                break;
              } else if (decision.type === 'ask_user') {
                const toolCallId = `ask_${Date.now()}`;
                contentBlocks.push({
                  type: 'tool_use',
                  id: toolCallId,
                  name: 'ask_user',
                  status: ChatToolCallStatus.AWAITING_INPUT,
                  input: decision.askUserResult,
                  output: {
                    __requires_user_input: true,
                    questions: decision.askUserResult?.questions,
                  },
                  agent: 'router',
                  visibility: 'ui',
                } as ChatContentBlock);
                callbacks?.onToolCall?.({
                  toolCallId,
                  toolName: 'ask_user',
                  input: decision.askUserResult,
                  agent: 'router',
                  visibility: 'ui',
                });
                callbacks?.onToolResult?.({
                  toolCallId,
                  toolName: 'ask_user',
                  result: {
                    __requires_user_input: true,
                    questions: decision.askUserResult?.questions,
                  },
                  agent: 'router',
                  visibility: 'ui',
                });
                break;
              } else {
                break;
              }
            } else {
              // ─── Specialist Phase ────────────────────────────────────────
              const agentDef = AGENTS[currentAgent];
              if (!agentDef) {
                this.logger.error(`Unknown agent: ${currentAgent}`);
                break;
              }

              callbacks?.onAgentSwitch?.({
                agent: currentAgent,
              });

              specialistRan = true;

              const result = await this.runSpecialist({
                agentName: currentAgent,
                agentDef,
                model: getModelForTier(agentDef.modelTier),
                context: toolContext,
                baseId,
                baseName,
                sessionId,
                userRoles,
                messages: coreMessages,
                newUserMessage: firstUserMessage || '',
                turnSummaries,
                routerInstruction,
                req,
                approvals,
                abortSignal: abortController.signal,
                contentBlocks,
                callbacks,
                suppressText: true,
              });

              totalInputTokens += result.inputTokens;
              totalOutputTokens += result.outputTokens;

              if (result.returnToRouter) {
                turnSummaries.push(result.turnSummary!);
                currentAgent = 'router';
              } else {
                break;
              }
            }
          }

          // ── 5b. Summarize — generate polished response after specialists complete ──
          const hasPendingApprovals = contentBlocks.some(
            (b) =>
              b.type === 'tool_use' &&
              b.status === ChatToolCallStatus.AWAITING_APPROVAL,
          );

          if (
            specialistRan &&
            !hasPendingApprovals &&
            !abortController.signal.aborted
          ) {
            const { inputTokens: sIn, outputTokens: sOut } =
              await this.runSummarize({
                model: getModelForTier('high'),
                context: toolContext,
                baseId,
                baseName,
                sessionId,
                userQuery: firstUserMessage || '',
                turnSummaries,
                contentBlocks,
                req,
                abortSignal: abortController.signal,
                callbacks,
              });
            totalInputTokens += sIn;
            totalOutputTokens += sOut;
          }

          // Persist turn summaries for session continuity
          if (turnSummaries.length > 0) {
            try {
              const currentMeta = session?.meta || {};
              await ChatSession.update(context, sessionId, {
                meta: { ...currentMeta, turnSummaries },
              });
            } catch (e) {
              this.logger.warn('Failed to persist turn summaries', e.message);
            }
          }

          // ── 6. Persist assistant message ──────────────────────────────────
          try {
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
              role: ChatMessageRole.ASSISTANT,
              parts: contentBlocks,
              model: model.modelId || 'unknown',
              input_tokens: totalInputTokens,
              output_tokens: totalOutputTokens,
              bt_span_id: span?.id ?? null,
            });

            await ChatSession.incrementTokens(context, sessionId, {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
            });

            await integration.storeInsert(context, req.user?.id, {
              inputTokens: totalInputTokens,
              outputTokens: totalOutputTokens,
            });

            // Send message-done immediately
            callbacks?.onDone?.({
              messageId: assistantMessage.id,
              parts: contentBlocks,
              btSpanId: assistantMessage.bt_span_id ?? null,
            });

            try {
              const followUps = await this.suggestionsService.generateFollowUps(
                toolContext,
                getModelForTier('low'),
                contentBlocks,
                firstUserMessage,
                req,
              );
              if (followUps?.length) {
                callbacks?.onFollowUps?.({
                  messageId: assistantMessage.id,
                  followUps,
                });
              }
            } catch (e) {
              this.logger.warn('Failed to generate follow-ups', e.message);
            }
          } catch (e) {
            this.logger.error('Failed to persist chat response', e.stack);
            callbacks?.onError?.('Failed to persist response');
          }

          // Use the last text block as output — this is the summarize output when
          // a specialist ran, or the router/direct response otherwise.
          const textBlocks = contentBlocks.filter(
            (b): b is { type: 'text'; text: string } => b.type === 'text',
          );
          const finalOutput = textBlocks[textBlocks.length - 1]?.text ?? '';

          span?.log({
            output: finalOutput,
            metadata: {
              specialistRan,
              rounds: agentHistory.length,
              totalInputTokens,
              totalOutputTokens,
            },
          });
        },
        { metadata: { sessionId } },
      );
    } catch (e) {
      if (abortController.signal.aborted) {
        this.logger.log(`Chat stream aborted for session ${sessionId}`);
      } else {
        this.logger.error('Error in multi-agent orchestration', e.stack);
        callbacks?.onError?.('Stream error');
      }
    } finally {
      if (this.activeStreams.get(sessionId) === abortController) {
        this.activeStreams.delete(sessionId);
      }
    }
  }

  /**
   * Execute approved/denied tool calls from a pending message.
   * Returns updated parts or null if session/message not found.
   */
  async executeApprovals(
    context: NcContext,
    params: {
      sessionId: string;
      messageId: string;
      decisions: Record<string, 'approved' | 'denied'>;
      req: NcRequest;
    },
  ): Promise<ChatContentBlock[] | null> {
    const { sessionId, messageId, decisions, req } = params;

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

    const toolContext = await this.buildToolContext(context, req);

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
            ? result
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

  /**
   * Build Socket.IO broadcast callbacks for job processors.
   */
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
      onToken: (content) =>
        broadcast({ action: ChatEventAction.TOKEN, content }),
      onToolStart: (ts) =>
        broadcast({
          action: ChatEventAction.TOOL_START,
          toolCallId: ts.toolCallId,
          name: ts.toolName,
          agent: ts.agent,
          visibility: ts.visibility,
        } as any),
      onToolCall: (tc) =>
        broadcast({
          action: ChatEventAction.TOOL_CALL,
          toolCallId: tc.toolCallId,
          name: tc.toolName,
          args: tc.input,
        }),
      onToolResult: (tr) =>
        broadcast({
          action: ChatEventAction.TOOL_RESULT,
          toolCallId: tr.toolCallId,
          output: tr.result,
          isError: false,
        }),
      onAgentSwitch: ({ agent, label }) =>
        broadcast({
          action: ChatEventAction.AGENT_SWITCH,
          agent,
          agentLabel: label,
        }),
      onDone: ({ messageId, parts, btSpanId }) =>
        broadcast({
          action: ChatEventAction.MESSAGE_DONE,
          workspaceId,
          messageId,
          parts,
          btSpanId,
        }),
      onFollowUps: ({ messageId, followUps }) =>
        broadcast({
          action: ChatEventAction.FOLLOW_UPS,
          messageId,
          followUps,
        }),
      onError: (error) => {
        logger.error(`Chat failed for session ${sessionId}: ${error}`);
        broadcast({ action: ChatEventAction.ERROR, error });
      },
    };
  }

  /**
   * Abort any in-flight LLM stream for the given session (local process).
   * @returns true if a stream was actually aborted
   */
  abortStream(sessionId: string): boolean {
    const controller = this.activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Builds a tool-execution context: resolves base_roles and managed app info
   * for the current base context.
   */
  async buildToolContext(
    context: NcContext,
    req: NcRequest,
  ): Promise<NcContext> {
    const toolContext = { ...context };
    const baseId = context.base_id;

    if (baseId && !req.user.base_roles) {
      const userWithRoles = await User.getWithRoles(toolContext, req.user.id, {
        baseId,
        workspaceId: context.workspace_id,
      });
      req.user.base_roles = userWithRoles.base_roles;
    }

    if (baseId) {
      const base = await Base.get(toolContext, baseId);
      if (base) {
        await Base.populateManagedAppInfo(base);
        toolContext.schema_locked = !!(
          base.managed_app_schema_locked || base.is_sandbox_master
        );
      }
    }

    return toolContext;
  }

  // ---------------------------------------------------------------------------
  // Private — Router
  // ---------------------------------------------------------------------------

  private async runRouter(params: {
    model: any;
    context: NcContext;
    baseId?: string;
    baseName?: string;
    sessionId: string;
    userRoles: { workspaceRole: string; baseRole: string | null };
    messages: any[];
    newUserMessage: string;
    turnSummaries: TurnSummary[];
    agentHistory: string[];
    req: NcRequest;
    abortSignal?: AbortSignal;
  }): Promise<{
    type: 'route' | 'respond' | 'done' | 'ask_user';
    agent?: string;
    instruction?: string;
    text?: string;
    askUserResult?: any;
    inputTokens: number;
    outputTokens: number;
  }> {
    const schemaContext = params.baseId
      ? await this.contextService.buildSchemaForAgent(
          'router',
          params.context,
          params.baseId,
          undefined,
          params.req,
        )
      : '';

    const routerPrompt = AGENTS.router.buildPrompt({
      schemaContext,
      baseName: params.baseName,
      userRoles: params.userRoles,
      turnSummaries: params.turnSummaries.map(
        (ts) =>
          `[${ts.agent}] ${ts.summary} (completed: ${
            ts.completed.join(', ') || 'none'
          }; remaining: ${ts.remaining.join(', ') || 'none'})`,
      ),
      agentHistory: params.agentHistory,
    } as RouterPromptParams);

    const routerTools = this.buildRouterTools(params.agentHistory);

    try {
      return await chatTraced(`router:${params.sessionId}`, async (span) => {
        span?.log({
          input: { agentHistoryPath: params.agentHistory.join(' → ') },
          metadata: { round: params.agentHistory.length },
          tags: ['chat', 'router'],
        });

        const result = await chatAi.generateText({
          model: params.model,
          system: routerPrompt,
          messages: [
            ...params.messages,
            ...(params.newUserMessage
              ? [{ role: 'user' as const, content: params.newUserMessage }]
              : []),
          ],
          tools: routerTools,
          stopWhen: stepCountIs(ROUTER_MAX_TURNS),
          abortSignal: params.abortSignal,
        });

        const usage = result.usage || { inputTokens: 0, outputTokens: 0 };

        for (const step of result.steps || []) {
          for (const tc of step.toolCalls || []) {
            if (tc.toolName === 'route_to_agent') {
              const decision = {
                type: 'route' as const,
                agent: tc.input.agent,
                instruction: tc.input.instruction,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              };
              span?.log({
                output: { decision: 'route', nextAgent: tc.input.agent },
              });
              return decision;
            }
            if (tc.toolName === 'respond_directly') {
              span?.log({ output: { decision: 'respond' } });
              return {
                type: 'respond' as const,
                text: tc.input.message,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              };
            }
            if (tc.toolName === 'ask_user') {
              span?.log({ output: { decision: 'ask_user' } });
              return {
                type: 'ask_user' as const,
                askUserResult: tc.input,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              };
            }
            if (tc.toolName === 'mark_complete') {
              span?.log({ output: { decision: 'done' } });
              return {
                type: 'done' as const,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              };
            }
          }
        }

        if (result.text) {
          span?.log({ output: { decision: 'respond' } });
          return {
            type: 'respond' as const,
            text: result.text,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          };
        }

        span?.log({ output: { decision: 'done' } });
        return {
          type: 'done' as const,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        };
      });
    } catch (e) {
      if (params.abortSignal?.aborted) {
        return { type: 'done', inputTokens: 0, outputTokens: 0 };
      }
      this.logger.error('Router LLM call failed', e.stack);
      return { type: 'done', inputTokens: 0, outputTokens: 0 };
    }
  }

  // ---------------------------------------------------------------------------
  // Private — Specialist
  // ---------------------------------------------------------------------------

  private async runSpecialist(params: {
    agentName: string;
    agentDef: AgentDefinition;
    model: any;
    context: NcContext;
    baseId?: string;
    baseName?: string;
    sessionId: string;
    userRoles: { workspaceRole: string; baseRole: string | null };
    messages: any[];
    newUserMessage: string;
    turnSummaries: TurnSummary[];
    routerInstruction?: string;
    req: NcRequest;
    approvals: Record<string, 'approved' | 'denied'>;
    abortSignal?: AbortSignal;
    contentBlocks: ChatContentBlock[];
    callbacks?: ChatCallbacks;
    /** When true, specialist text output is suppressed — summarize will write the response instead. */
    suppressText?: boolean;
  }): Promise<{
    returnToRouter: boolean;
    turnSummary?: TurnSummary;
    inputTokens: number;
    outputTokens: number;
  }> {
    const {
      agentName,
      agentDef,
      model,
      context,
      baseId,
      baseName,
      userRoles,
      messages,
      newUserMessage,
      turnSummaries,
      routerInstruction,
      req,
      approvals,
      abortSignal,
      contentBlocks,
      callbacks,
      suppressText = false,
    } = params;

    const schemaContext = baseId
      ? await this.contextService.buildSchemaForAgent(
          agentName,
          context,
          baseId,
          undefined,
          req,
        )
      : '';

    const specialistPrompt = agentDef.buildPrompt({
      schemaContext,
      baseName,
      userRoles,
      turnSummaries: turnSummaries.map(
        (ts) =>
          `[${ts.agent}] ${ts.summary} (completed: ${
            ts.completed.join(', ') || 'none'
          })`,
      ),
      routerInstruction,
    } as SpecialistPromptParams);

    const toolContext = baseId ? { ...context, base_id: baseId } : context;
    const vercelTools = this.toolRegistry.getToolSet(
      agentDef.tools,
      toolContext,
      req,
      approvals,
    );

    // Add return_to_router tool
    let returnToRouterResult: TurnSummary | null = null;

    vercelTools['return_to_router'] = tool({
      description:
        'Return control to the router when your part of the task is done ' +
        'or when the remaining work requires a different specialist. ' +
        'Provide a structured summary of what you accomplished.',
      inputSchema: z.object({
        summary: z.string().describe('Brief summary of what was accomplished'),
        completed: z.array(z.string()).describe('List of completed sub-tasks'),
        remaining: z
          .array(z.string())
          .describe('List of remaining sub-tasks that need another specialist'),
      }),
      execute: async (input) => {
        returnToRouterResult = {
          agent: agentName,
          summary: input.summary,
          completed: input.completed,
          remaining: input.remaining,
        };
        return 'Returning to router.';
      },
    });

    try {
      return await chatTraced(
        `specialist:${agentName}:${params.sessionId}`,
        async (span) => {
          span?.log({
            input: {
              agentName,
              instruction: routerInstruction,
              tools: Object.keys(vercelTools).filter(
                (t) => t !== 'return_to_router',
              ),
            },
            tags: ['chat', 'specialist', `agent:${agentName}`],
          });

          const result = chatAi.streamText({
            model,
            system: specialistPrompt,
            messages: [
              ...messages,
              ...(newUserMessage
                ? [{ role: 'user' as const, content: newUserMessage }]
                : []),
            ],
            tools: vercelTools,
            abortSignal,
            stopWhen: [
              stepCountIs(agentDef.maxTurns),
              ({ steps }) =>
                steps.some((step) =>
                  (step.toolResults || []).some((tr) => {
                    if (typeof tr.output !== 'string') return false;
                    try {
                      return JSON.parse(tr.output).__requires_approval;
                    } catch {
                      return false;
                    }
                  }),
                ),
            ],
            onChunk: ({ chunk }) => {
              if (abortSignal?.aborted) return;

              if (chunk.type === 'text-delta') {
                if (!suppressText) {
                  const last = contentBlocks[contentBlocks.length - 1];
                  if (last && last.type === 'text') {
                    (last as { type: 'text'; text: string }).text += chunk.text;
                  } else {
                    contentBlocks.push({ type: 'text', text: chunk.text });
                  }
                  callbacks?.onToken?.(chunk.text);
                }
                // When suppressText: discard specialist text — summarize will write the response.
              }

              if (chunk.type === 'tool-input-start') {
                const visibility = this.getToolVisibility(chunk.toolName);

                contentBlocks.push({
                  type: 'tool_use',
                  id: chunk.id,
                  name: chunk.toolName,
                  status: ChatToolCallStatus.RUNNING,
                  agent: agentName,
                  visibility,
                } as ChatContentBlock);

                if (
                  visibility !== 'hidden' &&
                  chunk.toolName !== 'return_to_router'
                ) {
                  callbacks?.onToolStart?.({
                    toolCallId: chunk.id,
                    toolName: chunk.toolName,
                    agent: agentName,
                    visibility,
                  });
                }
              }
            },
            onStepFinish: ({ toolCalls, toolResults }) => {
              if (abortSignal?.aborted) return;

              for (const tc of toolCalls || []) {
                // announce: broadcast label update and skip normal processing
                if (tc.toolName === ChatToolName.ANNOUNCE) {
                  const message = (tc.input as any)?.message;
                  if (message) {
                    callbacks?.onAgentSwitch?.({
                      agent: agentName,
                      label: message,
                    });
                  }
                  continue;
                }

                const block = contentBlocks.find(
                  (b): b is Extract<ChatContentBlock, { type: 'tool_use' }> =>
                    b.type === 'tool_use' && b.id === tc.toolCallId,
                );
                if (block) block.input = tc.input;

                const visibility = this.getToolVisibility(tc.toolName);
                if (
                  visibility !== 'hidden' &&
                  tc.toolName !== 'return_to_router'
                ) {
                  callbacks?.onToolCall?.({
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    input: tc.input,
                    agent: agentName,
                    visibility,
                  });
                }
              }

              for (const tr of toolResults || []) {
                const block = contentBlocks.find(
                  (b): b is Extract<ChatContentBlock, { type: 'tool_use' }> =>
                    b.type === 'tool_use' && b.id === tr.toolCallId,
                );
                if (block) {
                  block.output = tr.output;
                  block.is_error = false;

                  // Extract __metadata from tool output into block.metadata
                  try {
                    let outputObj = tr.output;
                    if (typeof outputObj === 'string') {
                      outputObj = JSON.parse(outputObj);
                    }
                    if (
                      outputObj &&
                      typeof outputObj === 'object' &&
                      outputObj.__metadata
                    ) {
                      block.metadata = outputObj.__metadata;
                      delete outputObj.__metadata;
                      block.output =
                        typeof tr.output === 'string'
                          ? JSON.stringify(outputObj)
                          : outputObj;
                    }
                  } catch {
                    // ignore parse errors — output stays as-is
                  }
                }

                const visibility = this.getToolVisibility(tr.toolName);
                if (
                  visibility !== 'hidden' &&
                  tr.toolName !== 'return_to_router'
                ) {
                  callbacks?.onToolResult?.({
                    toolCallId: tr.toolCallId,
                    toolName: tr.toolName,
                    result: tr.output,
                    agent: agentName,
                    visibility,
                  });
                }
              }
            },
          });

          // Consume stream
          await result.text;

          const usage = (await result.usage) || {
            inputTokens: 0,
            outputTokens: 0,
          };

          // Resolve tool statuses from steps
          const steps = await result.steps;
          for (const step of steps || []) {
            for (const tr of step.toolResults || []) {
              const block = contentBlocks.find(
                (b): b is Extract<ChatContentBlock, { type: 'tool_use' }> =>
                  b.type === 'tool_use' && b.id === tr.toolCallId,
              );
              if (!block) continue;

              let status: ChatToolCallStatus;
              const raw = tr.output;
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
                (raw as any).__requires_user_input
              ) {
                status = ChatToolCallStatus.AWAITING_INPUT;
              } else {
                status = ChatToolCallStatus.SUCCESS;
              }
              block.status = status;
            }

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

          span?.log({
            output: { returnToRouter: !!returnToRouterResult },
            metadata: {
              tokens: { input: usage.inputTokens, output: usage.outputTokens },
            },
          });

          return {
            returnToRouter: !!returnToRouterResult,
            turnSummary: returnToRouterResult || undefined,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          };
        },
      );
    } catch (e) {
      if (abortSignal?.aborted) {
        for (const block of contentBlocks) {
          if (
            block.type === 'tool_use' &&
            block.status === ChatToolCallStatus.RUNNING
          ) {
            block.status = ChatToolCallStatus.ERROR;
          }
        }
        return {
          returnToRouter: false,
          inputTokens: 0,
          outputTokens: 0,
        };
      }
      this.logger.error(
        `Specialist ${agentName} failed: ${e.message}`,
        e.stack,
      );
      return {
        returnToRouter: false,
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Private — Router tools
  // ---------------------------------------------------------------------------

  private buildRouterTools(agentHistory: string[]): ToolSet {
    const lastSpecialist =
      agentHistory.length >= 2
        ? agentHistory[agentHistory.length - 2]
        : undefined;

    const availableAgents = SPECIALIST_NAMES.filter(
      (name) => name !== lastSpecialist,
    );

    const agentDescriptions = availableAgents
      .map((name) => {
        const def = AGENTS[name];
        return `- **${name}**: ${def.description}`;
      })
      .join('\n');

    return {
      route_to_agent: tool({
        description: `Dispatch to a specialist agent.\n\nAvailable agents:\n${agentDescriptions}`,
        inputSchema: z.object({
          agent: z
            .enum(availableAgents as [string, ...string[]])
            .describe('The specialist agent to dispatch to'),
          instruction: z
            .string()
            .describe(
              'Focused instruction for the specialist — include table names, field names, and what to do',
            ),
        }),
        execute: async (input) => {
          return `Routing to ${input.agent}: ${input.instruction}`;
        },
      }),
      respond_directly: tool({
        description:
          'Answer simple questions directly without routing to a specialist. ' +
          'Use for greetings, explanations, schema questions, or clarifications.',
        inputSchema: z.object({
          message: z.string().describe('The response message to the user'),
        }),
        execute: async (input) => {
          return input.message;
        },
      }),
      mark_complete: tool({
        description:
          'Signal that the full user request has been fulfilled. ' +
          'Use when all turn summaries together cover the complete request.',
        inputSchema: z.object({
          summary: z
            .string()
            .optional()
            .describe('Optional final summary of everything accomplished'),
        }),
        execute: async () => {
          return 'Task complete.';
        },
      }),
      ask_user: tool({
        description:
          'Ask the user a clarifying question with predefined options. ' +
          'Use when the request is ambiguous and you need the user to choose ' +
          'between approaches before routing to a specialist.',
        inputSchema: z.object({
          questions: z
            .array(
              z.object({
                question: z.string().describe('The question to display'),
                options: z
                  .array(z.string())
                  .min(2)
                  .max(5)
                  .describe('2–5 short option labels'),
              }),
            )
            .min(1)
            .max(4)
            .describe('Array of 1–4 questions, each with its own options'),
        }),
        execute: async (input) => {
          return {
            __requires_user_input: true,
            questions: input.questions,
          };
        },
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Private — Summarize
  // ---------------------------------------------------------------------------

  private async runSummarize(params: {
    model: any;
    context: NcContext;
    baseId?: string;
    baseName?: string;
    sessionId: string;
    userQuery: string;
    turnSummaries: TurnSummary[];
    contentBlocks: ChatContentBlock[];
    req: NcRequest;
    abortSignal?: AbortSignal;
    callbacks?: ChatCallbacks;
  }): Promise<{ inputTokens: number; outputTokens: number }> {
    const {
      model,
      context,
      baseId,
      baseName,
      userQuery,
      turnSummaries,
      contentBlocks,
      req,
      abortSignal,
      callbacks,
    } = params;

    const schemaContext = baseId
      ? await this.contextService.buildSchemaForAgent(
          'qa', // use qa depth — full field details
          context,
          baseId,
          undefined,
          req,
        )
      : '';

    const toolContext = this.buildToolContextForSummarize(contentBlocks);

    const { system: summarizeSystem, messages: summarizeMessages } =
      buildSummarizePrompt({
        userQuery,
        turnSummaries: turnSummaries.map((ts) => ({
          agent: ts.agent,
          summary: ts.summary,
          completed: ts.completed,
        })),
        toolContext,
        schemaContext,
        baseName,
      } as SummarizePromptParams);

    try {
      return await chatTraced(`summarize:${params.sessionId}`, async (span) => {
        span?.log({
          input: { userQuery, agentCount: turnSummaries.length },
          tags: ['chat', 'summarize'],
        });

        const stream = chatAi.streamText({
          model,
          system: summarizeSystem,
          messages: summarizeMessages,
          abortSignal,
        });

        let text = '';
        for await (const chunk of stream.textStream) {
          if (abortSignal?.aborted) break;
          text += chunk;
          callbacks?.onToken?.(chunk);
        }

        if (text) {
          contentBlocks.push({ type: 'text', text });
        }

        const usage = (await stream.usage) || {
          inputTokens: 0,
          outputTokens: 0,
        };

        span?.log({
          output: text,
          metadata: {
            tokens: { input: usage.inputTokens, output: usage.outputTokens },
          },
        });

        return {
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        };
      });
    } catch (e) {
      if (abortSignal?.aborted) {
        return { inputTokens: 0, outputTokens: 0 };
      }
      this.logger.error('Summarize LLM call failed', e.stack);
      return { inputTokens: 0, outputTokens: 0 };
    }
  }

  /**
   * Condense contentBlocks into a readable summary for the summarize prompt.
   * Includes tool inputs and outputs (truncated) for the most relevant tools.
   */
  private buildToolContextForSummarize(
    contentBlocks: ChatContentBlock[],
  ): string {
    const SKIP_TOOLS = new Set([
      'return_to_router',
      'announce',
      'route_to_agent',
      'mark_complete',
      'respond_directly',
    ]);
    const MAX_OUTPUT_CHARS = 4000;

    const lines: string[] = [];

    for (const block of contentBlocks) {
      if (block.type !== 'tool_use') continue;
      if (SKIP_TOOLS.has(block.name)) continue;

      lines.push(`### ${block.name}`);

      if (block.input && Object.keys(block.input).length > 0) {
        lines.push(
          `Input: ${JSON.stringify(block.input, null, 2).slice(0, 1000)}`,
        );
      }

      if (block.output !== undefined && block.output !== null) {
        let outputStr: string;
        try {
          outputStr =
            typeof block.output === 'string'
              ? block.output
              : JSON.stringify(block.output, null, 2);
        } catch {
          outputStr = String(block.output);
        }
        if (outputStr.length > MAX_OUTPUT_CHARS) {
          outputStr =
            outputStr.slice(0, MAX_OUTPUT_CHARS) + '\n... (truncated)';
        }
        lines.push(`Result: ${outputStr}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Private — Helpers
  // ---------------------------------------------------------------------------

  /**
   * Detect pathological routing patterns in the agent history.
   */
  private detectLoop(history: string[]): boolean {
    if (history.length < 4) return false;

    const window = history.slice(-6);

    // Pattern: A→R→A→R (specialist ping-pong)
    if (window.length >= 4) {
      const last4 = window.slice(-4);
      if (
        last4[0] === last4[2] &&
        last4[1] === 'router' &&
        last4[3] === 'router' &&
        last4[0] !== 'router'
      ) {
        return true;
      }
    }

    // Pattern: A→R→B→R→A→R (three-hop oscillation)
    if (window.length >= 6) {
      const specialists = window.filter((a) => a !== 'router');
      if (specialists.length >= 3 && specialists[0] === specialists[2]) {
        return true;
      }
    }

    return false;
  }

  private getToolVisibility(toolName: string): string {
    if (toolName === 'return_to_router') return 'hidden';
    if (toolName === 'route_to_agent') return 'hidden';
    if (toolName === 'respond_directly') return 'hidden';
    if (toolName === 'mark_complete') return 'hidden';
    return this.toolRegistry.getToolVisibility(toolName);
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

  private async generateSessionTitle(
    model: any,
    userMessage: string,
    sessionId: string,
  ): Promise<string | undefined> {
    return chatTraced(`title-generation:${sessionId}`, async (span) => {
      span?.log({
        input: userMessage,
        tags: ['chat', 'title'],
      });

      const result = await chatAi.generateText({
        model,
        system: TITLE_GENERATION_SYSTEM_PROMPT,
        messages: buildTitleGenerationMessages(userMessage),
        maxOutputTokens: 60,
      });

      const title = result.text?.trim();
      if (!title || title.length === 0) return undefined;

      const finalTitle = title.length > 50 ? title.slice(0, 47) + '...' : title;
      span?.log({ output: finalTitle });
      return finalTitle;
    });
  }
}
