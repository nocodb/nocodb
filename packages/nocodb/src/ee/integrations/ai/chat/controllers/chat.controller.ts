import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  NC_NEW_SESSION,
  NcContext,
  NcRequest,
  PlanFeatureTypes,
} from 'nocodb-sdk';
import type {
  ChatAttachmentType,
  ChatSendMessageResponseType,
} from 'nocodb-sdk';
import { ChatService } from '~/integrations/ai/chat/services/chat.service';
import { ChatSessionService } from '~/integrations/ai/chat/services/chat-session.service';
import { ChatSuggestionsService } from '~/integrations/ai/chat/services/chat-suggestions.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { License } from '~/decorators/license.decorator';

const PREFIX = '/api/v2/internal/:workspaceId/:baseId';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@License(PlanFeatureTypes.FEATURE_AI_CHAT)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatSessionService: ChatSessionService,
    private readonly suggestionsService: ChatSuggestionsService,
  ) {}

  @Get(`${PREFIX}/chat/suggestions`)
  @Acl('chatSuggestionsGet', { scope: 'base' })
  async suggestions(
    @TenantContext() context: NcContext,
    @Query('type') type: string,
    @Query('fileNames') fileNames: string,
    @Request() req: NcRequest,
  ) {
    return await this.suggestionsService.getSuggestions(context, {
      type,
      fileNames: fileNames
        ? fileNames
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        : undefined,
      req,
    });
  }

  @Get(`${PREFIX}/chat/sessions`)
  @Acl('chatSessionList', { scope: 'base' })
  async sessionList(
    @TenantContext() context: NcContext,
    @Request() req: NcRequest,
  ) {
    return await this.chatSessionService.sessionList(context, {
      req,
    });
  }

  @Patch(`${PREFIX}/chat/sessions/:sessionId`)
  @Acl('chatSessionUpdate', { scope: 'base' })
  async sessionUpdate(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Body() body: { title: string },
    @Request() req: NcRequest,
  ) {
    return await this.chatSessionService.sessionUpdate(context, {
      sessionId,
      title: body.title,
      req,
    });
  }

  @Delete(`${PREFIX}/chat/sessions/:sessionId`)
  @Acl('chatSessionDelete', { scope: 'base' })
  async sessionDelete(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Request() req: NcRequest,
  ) {
    return await this.chatSessionService.sessionDelete(context, {
      sessionId,
      req,
    });
  }

  @Get(`${PREFIX}/chat/sessions/:sessionId/messages`)
  @Acl('chatMessageList', { scope: 'base' })
  async messageList(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Request() req: NcRequest,
  ) {
    return await this.chatSessionService.messageList(context, {
      sessionId,
      limit: limit
        ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)
        : undefined,
      offset: offset ? Math.max(parseInt(offset, 10) || 0, 0) : undefined,
      req,
    });
  }

  @Get(`${PREFIX}/chat/sessions/:sessionId/follow-ups`)
  @Acl('chatSuggestionsGet', { scope: 'base' })
  async followUps(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Request() req: NcRequest,
  ) {
    return await this.suggestionsService.getFollowUps(context, {
      sessionId,
      req,
    });
  }

  @Post(`${PREFIX}/chat/sessions/:sessionId/abort`)
  @Acl('chatMessageSend', { scope: 'base' })
  async abortSession(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Request() req: NcRequest,
  ) {
    await this.chatService.abortSession(context, { sessionId, req });
    return {};
  }

  @Post(`${PREFIX}/chat/sessions/:sessionId/messages`)
  @Acl('chatMessageSend', { scope: 'base' })
  async messageSend(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      content: string;
      files?: ChatAttachmentType[];
      approvals?: Record<string, 'approved' | 'denied'>;
      title?: string;
    },
    @Request() req: NcRequest,
  ): Promise<ChatSendMessageResponseType> {
    const isNewSession = sessionId === NC_NEW_SESSION;

    let resolvedSessionId = sessionId;
    let createdSession: ChatSendMessageResponseType['session'];

    if (isNewSession) {
      const session = await this.chatSessionService.sessionCreate(context, {
        title: body.title,
        req,
      });
      resolvedSessionId = session.id;
      createdSession = session;
    }

    await this.chatService.sendMessage(context, {
      sessionId: resolvedSessionId,
      body: {
        content: body.content,
        files: body.files,
        approvals: body.approvals,
      },
      req,
    });

    return { session: createdSession };
  }

  @Post(`${PREFIX}/chat/sessions/:sessionId/messages/:messageId/feedback`)
  @Acl('chatMessageSend', { scope: 'base' })
  async messageFeedback(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Body() body: { score: number; comment?: string },
    @Request() req: NcRequest,
  ) {
    return await this.chatSessionService.messageFeedback(context, {
      sessionId,
      messageId,
      score: body.score,
      comment: body.comment,
      req,
    });
  }

  @Post(`${PREFIX}/chat/sessions/:sessionId/messages/:messageId/approve`)
  @Acl('chatMessageSend', { scope: 'base' })
  async approveToolCalls(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Body()
    body: {
      decisions: Record<string, 'approved' | 'denied'>;
    },
    @Request() req: NcRequest,
  ) {
    await this.chatService.approveToolCalls(context, {
      sessionId,
      messageId,
      decisions: body.decisions || {},
      req,
    });

    return {};
  }
}
