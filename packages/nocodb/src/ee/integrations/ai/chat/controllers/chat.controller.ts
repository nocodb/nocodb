import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { NcContext, NcRequest } from '~/interface/config';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(['/api/v2/chat/bases/:baseId/sessions'])
  @Acl('chatSessionCreate', { scope: 'base' })
  @HttpCode(200)
  async sessionCreate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Body() body: { title?: string },
  ) {
    return await this.chatService.sessionCreate(context, {
      title: body.title,
      req,
    });
  }

  @Get(['/api/v2/chat/bases/:baseId/sessions'])
  @Acl('chatSessionList', { scope: 'base' })
  async sessionList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
  ) {
    return await this.chatService.sessionList(context, { req });
  }

  @Get(['/api/v2/chat/bases/:baseId/sessions/:sessionId'])
  @Acl('chatSessionGet', { scope: 'base' })
  async sessionGet(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Req() req: NcRequest,
  ) {
    return await this.chatService.sessionGet(context, {
      sessionId,
      req,
    });
  }

  @Delete(['/api/v2/chat/bases/:baseId/sessions/:sessionId'])
  @Acl('chatSessionDelete', { scope: 'base' })
  async sessionDelete(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Req() req: NcRequest,
  ) {
    return await this.chatService.sessionDelete(context, {
      sessionId,
      req,
    });
  }

  @Get(['/api/v2/chat/bases/:baseId/sessions/:sessionId/messages'])
  @Acl('chatMessageList', { scope: 'base' })
  async messageList(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
    @Req() req: NcRequest,
  ) {
    return await this.chatService.messageList(context, {
      sessionId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      req,
    });
  }

  @Post(['/api/v2/chat/bases/:baseId/sessions/:sessionId/messages'])
  @Acl('chatMessageSend', { scope: 'base' })
  @HttpCode(200)
  async sendMessage(
    @TenantContext() context: NcContext,
    @Param('sessionId') sessionId: string,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Body() body: { content: string; context?: any },
  ) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = await this.chatService.sendMessage(context, {
      sessionId,
      body: {
        content: body.content,
        context: body.context,
      },
      req,
    });

    // Pipe the ReadableStream to the response
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      // Client disconnected or stream error — silently close
    } finally {
      res.end();
    }
  }
}
