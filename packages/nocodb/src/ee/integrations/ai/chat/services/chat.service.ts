import { Injectable, Logger } from '@nestjs/common';
import { ChatEventAction, ChatMessageRole, PlanFeatureTypes } from 'nocodb-sdk';
import type { OnModuleInit } from '@nestjs/common';
import type { ChatSendMessageType } from 'nocodb-sdk';
import type { ChatApprovalJobData, ChatMessageJobData } from '~/interface/Jobs';
import type { NcContext, NcRequest } from '~/interface/config';
import { ChatAgentService } from '~/integrations/ai/chat/services/chat-agent.service';
import { ChatSessionService } from '~/integrations/ai/chat/services/chat-session.service';
import { MESSAGE_MAX_LENGTH } from '~/integrations/ai/chat/constants';
import ChatMessage from '~/models/ChatMessage';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { InstanceCommands, JobTypes } from '~/interface/Jobs';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';

@Injectable()
export class ChatService implements OnModuleInit {
  private readonly logger = new Logger(ChatService.name);

  private readonly abortAckResolvers = new Map<string, () => void>();

  constructor(
    private readonly sessionService: ChatSessionService,
    private readonly agentService: ChatAgentService,
    private readonly jobsService: NocoJobsService,
  ) {}

  onModuleInit() {
    if (!JobsRedis.available) return;

    // Worker side: receive abort command → abort stream → ack back to primary
    JobsRedis.workerCallbacks[InstanceCommands.ABORT_CHAT_STREAM] = async (
      sessionId: string,
    ) => {
      const aborted = this.agentService.abortStream(sessionId);
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

  async sendMessage(
    context: NcContext,
    params: {
      sessionId: string;
      body: ChatSendMessageType;
      req: NcRequest;
    },
  ): Promise<void> {
    const { sessionId, body, req } = params;

    if ((!body.content || body.content.length === 0) && !body.files?.length) {
      NcError.get(context).badRequest('Message content cannot be empty');
    }
    if (body.content && body.content.length > MESSAGE_MAX_LENGTH) {
      NcError.get(context).badRequest(
        `Message too long (max ${MESSAGE_MAX_LENGTH.toLocaleString()} characters)`,
      );
    }

    await this.sessionService.sessionGet(context, { sessionId, req });

    const userMessage = await ChatMessage.insert(context, {
      fk_session_id: sessionId,
      role: ChatMessageRole.USER,
      content: body.content,
      files: body.files?.length ? body.files : undefined,
    });

    this.sessionService.broadcastToUser(
      req.user?.id,
      { action: ChatEventAction.USER_MESSAGE, sessionId, message: userMessage },
      req.ncSocketId,
    );

    const chatJobId = `chat:msg:${sessionId}`;

    await this.removeStaleJob(chatJobId, sessionId);

    const jobData: Omit<ChatMessageJobData, 'jobName'> = {
      context,
      user: req.user,
      sessionId,
      firstUserMessage: body.content,
      approvals: body.approvals || {},
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
      req: NcRequest;
    },
  ): Promise<void> {
    const { sessionId, messageId, decisions, req } = params;

    for (const [key, value] of Object.entries(decisions)) {
      if (value !== 'approved' && value !== 'denied') {
        NcError.get(context).badRequest(
          `Invalid decision value for tool call ${key}`,
        );
      }
    }

    await this.sessionService.sessionGet(context, { sessionId, req });

    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);

    const msg = await ChatMessage.get(context, messageId, sessionId);
    if (!msg) {
      NcError.get(context).chatMessageNotFound(messageId);
    }

    const approvalJobId = `chat:approval:${sessionId}:${messageId}`;

    await this.removeStaleJob(approvalJobId, sessionId);

    const jobData: Omit<ChatApprovalJobData, 'jobName'> = {
      context,
      user: req.user,
      sessionId,
      messageId,
      decisions,
    };

    await this.jobsService.add(JobTypes.ChatApproval, jobData, {
      jobId: approvalJobId,
      removeOnFail: true,
    });
  }

  /**
   * Abort any in-flight chat job for the given session.
   */
  async abortSession(
    context: NcContext,
    params: {
      sessionId: string;
      req: NcRequest;
    },
  ): Promise<void> {
    const { sessionId, req } = params;

    await this.sessionService.sessionGet(context, { sessionId, req });

    try {
      await this.removeStaleJob(`chat:msg:${sessionId}`, sessionId);
    } catch {
      // Job may not exist — still abort the stream directly
    }

    this.agentService.abortStream(sessionId);

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
  }

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
}
