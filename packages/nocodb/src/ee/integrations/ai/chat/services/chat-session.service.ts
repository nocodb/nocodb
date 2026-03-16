import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  ChatEventAction,
  EventType,
  PlanFeatureTypes,
} from 'nocodb-sdk';
import type { ChatEventPayload } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import ChatSession from '~/models/ChatSession';
import ChatMessage from '~/models/ChatMessage';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoSocket from '~/socket/NocoSocket';
import { chatLogFeedback } from '~/integrations/ai/chat/braintrust.init';

@Injectable()
export class ChatSessionService {
  private readonly logger = new Logger(ChatSessionService.name);

  constructor(private readonly appHooksService: AppHooksService) {}

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
      fk_user_id: params.req.user?.id,
    });

    this.appHooksService.emit(AppEvents.CHAT_SESSION_CREATE, {
      context,
      req: params.req,
      sessionId: session.id,
    });

    this.broadcastToUser(
      params.req.user?.id,
      {
        action: ChatEventAction.SESSION_CREATE,
        sessionId: session.id,
        session,
      },
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
      userId: params.req.user?.id,
    });
  }

  /**
   * Fetch a session and verify workspace + ownership.
   * Used by other services as an ownership guard.
   */
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
      NcError.get(context).chatSessionNotFound(params.sessionId);
    }

    // Defense-in-depth: verify the session belongs to this workspace and base.
    if (session.fk_workspace_id !== context.workspace_id) {
      NcError.get(context).chatSessionNotFound(params.sessionId);
    }

    if (session.base_id !== context.base_id) {
      NcError.get(context).chatSessionNotFound(params.sessionId);
    }

    // Verify ownership
    if (session.fk_user_id !== params.req.user?.id) {
      NcError.get(context).chatSessionNotFound(params.sessionId);
    }

    return session;
  }

  async sessionUpdate(
    context: NcContext,
    params: {
      sessionId: string;
      title: string;
      req: NcRequest;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_AI_CHAT);

    const title = params.title?.trim();
    if (!title) {
      NcError.get(context).badRequest('Title cannot be empty');
    }
    if (title.length > 255) {
      NcError.get(context).badRequest('Title too long (max 255 characters)');
    }

    await this.sessionGet(context, params);

    await ChatSession.update(context, params.sessionId, { title });

    const updated = await ChatSession.get(context, params.sessionId);

    this.appHooksService.emit(AppEvents.CHAT_SESSION_UPDATE, {
      context,
      req: params.req,
      sessionId: params.sessionId,
    });

    this.broadcastToUser(
      params.req.user?.id,
      {
        action: ChatEventAction.SESSION_UPDATE,
        sessionId: params.sessionId,
        session: updated,
      },
      params.req.ncSocketId,
    );

    return updated;
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
      { action: ChatEventAction.SESSION_DELETE, sessionId: session.id },
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

  async messageFeedback(
    context: NcContext,
    params: {
      sessionId: string;
      messageId: string;
      score: number;
      comment?: string;
      req: NcRequest;
    },
  ) {
    await this.sessionGet(context, {
      sessionId: params.sessionId,
      req: params.req,
    });

    const message = await ChatMessage.get(
      context,
      params.messageId,
      params.sessionId,
    );

    if (!message) {
      NcError.get(context).genericNotFound('ChatMessage', params.messageId);
    }

    const score = params.score === 1 ? 1 : 0;
    chatLogFeedback(message.bt_span_id, score, params.comment);

    return { ok: true };
  }

  broadcastToUser(
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
