import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import { ChatService } from '../services/chat.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { License } from '~/decorators/license.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@License('Chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(`${PREFIX_APIV3_METABASE}/chat/sessions`)
  @Acl('chatSessionList', { scope: 'base' })
  async sessionList(
    @TenantContext() context: NcContext,
    @Request() req: NcRequest,
  ) {
    return await this.chatService.sessionList(context, { req });
  }

  @Get(`${PREFIX_APIV3_METABASE}/chat/sessions/:sessionId`)
  @Acl('chatSessionGet', { scope: 'base' })
  async sessionGet(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Request() req: NcRequest,
  ) {
    return await this.chatService.sessionGet(context, { sessionId, req });
  }

  @Post(`${PREFIX_APIV3_METABASE}/chat/sessions`)
  @Acl('chatSessionCreate', { scope: 'base' })
  async sessionCreate(
    @TenantContext() context: NcContext,
    @Body() body: { title?: string },
    @Request() req: NcRequest,
  ) {
    return await this.chatService.sessionCreate(context, {
      title: body.title,
      req,
    });
  }

  @Delete(`${PREFIX_APIV3_METABASE}/chat/sessions/:sessionId`)
  @Acl('chatSessionDelete', { scope: 'base' })
  async sessionDelete(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Request() req: NcRequest,
  ) {
    return await this.chatService.sessionDelete(context, { sessionId, req });
  }

  @Get(`${PREFIX_APIV3_METABASE}/chat/sessions/:sessionId/messages`)
  @Acl('chatMessageList', { scope: 'base' })
  async messageList(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Request() req: NcRequest,
  ) {
    return await this.chatService.messageList(context, {
      sessionId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      req,
    });
  }

  @Post(`${PREFIX_APIV3_METABASE}/chat/sessions/:sessionId/messages`)
  @Acl('chatMessageSend', { scope: 'base' })
  async messageSend(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      content: string;
      approvals?: Record<string, 'approved' | 'denied'>;
    },
    @Request() req: NcRequest,
  ) {
    const stream = await this.chatService.sendMessage(context, {
      sessionId,
      body: {
        content: body.content,
        approvals: body.approvals,
      },
      req,
    });

    // Consume the full stream (non-streaming response)
    const reader = stream.getReader();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Re-fetch messages to get persisted assistant message with tool_calls
    return await this.chatService.messageList(context, {
      sessionId,
      req,
    });
  }

  @Post(
    `${PREFIX_APIV3_METABASE}/chat/sessions/:sessionId/messages/:messageId/approve`,
  )
  @Acl('chatMessageSend', { scope: 'base' })
  async approveToolCalls(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Body() body: { decisions: Record<string, 'approved' | 'denied'> },
    @Request() req: NcRequest,
  ) {
    return await this.chatService.approveToolCalls(context, {
      sessionId,
      messageId,
      decisions: body.decisions || {},
      req,
    });
  }
}
