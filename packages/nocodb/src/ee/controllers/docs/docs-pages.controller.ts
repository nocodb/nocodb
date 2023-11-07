import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { DocsPageHistoryService } from '~/services/docs/history/docs-page-history.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DocsPagesService } from '~/services/docs/docs-pages.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class DocsPagesController {
  private logger = new Logger(DocsPagesController.name);

  constructor(
    private readonly pagesService: DocsPagesService,
    private readonly pageHistoryService: DocsPageHistoryService,
  ) {}

  @Get('/api/v1/docs/:baseId/pages/:id')
  @Acl('pageGet')
  async get(@Param('id') id: string, @Param('baseId') baseId: string) {
    return await this.pagesService.get({
      id,
      baseId,
    });
  }

  @Get('/api/v1/docs/:baseId/pages')
  @Acl('pageList')
  async list(@Param('baseId') baseId: string) {
    return await this.pagesService.list({
      baseId,
    });
  }

  @Post('/api/v1/docs/:baseId/pages')
  @Acl('pageCreate')
  async create(
    @Param('baseId') baseId: string,
    @Body() body: { attributes: any },
    @Req() req: Request,
  ) {
    const page = await this.pagesService.create({
      attributes: body.attributes,
      baseId,
      user: req.user,
    });

    try {
      await this.pageHistoryService.maybeInsert({
        newPage: page,
        workspaceId: req.ncWorkspaceId,
        snapshotType: 'created',
      });
    } catch (e) {
      this.logger.error(e);
    }

    return page;
  }

  @Put('/api/v1/docs/:baseId/pages/:id')
  @Acl('pageUpdate')
  async update(
    @Param('id') id: string,
    @Param('baseId') baseId: string,
    @Body() body: { attributes: any },
    @Req() req: Request,
  ) {
    return await this.pagesService.update({
      pageId: id,
      attributes: body.attributes,
      baseId,
      user: req.user,
      workspaceId: req.ncWorkspaceId,
    });
  }

  @Delete('/api/v1/docs/:baseId/pages/:id')
  @Acl('pageDelete')
  async delete(@Param('id') id: string, @Param('baseId') baseId: string) {
    return await this.pagesService.delete({
      id,
      baseId,
    });
  }

  @Post('/api/v1/docs/:baseId/pages/:id/gpt')
  @Acl('pageGpt')
  async gpt(
    @Param('id') id: string,
    @Param('baseId') baseId: string,
    @Res() response:Response,
    @Req() req: Request,
  ) {
    let body: {
      promptText: string;
      selectedPageText?: string;
    } = {
      promptText: '',
    };

    await new Promise((resolve) => {
      req.on('data', (chunk) => {
        try {
          const bodyChunk = JSON.parse(chunk.toString());
          body = { ...body, ...bodyChunk };
        } catch (e) {
          console.error(e);
        }
      });

      req.on('end', () => {
        resolve(true);
      });
    });

    return await this.pagesService.magicExpand({
      promptText: body.promptText,
      selectedPageText: body.selectedPageText,
      pageId: id,
      baseId,
      response,
    });
  }

  @Post('/api/v1/docs/:baseId/gpt')
  @Acl('docsMagicCreatePages')
  async gptCreatePages(
    @Param('baseId') baseId: string,
    @Body() body: { text: string },
    @Req() req: Request,
  ) {
    return await this.pagesService.magicCreatePages({
      baseId,
      title: body.text,
      user: req.user,
    });
  }

  @Post('/api/v1/docs/:baseId/import')
  @Acl('pageImport')
  async import(
    @Param('baseId') baseId: string,
    @Body()
    body: {
      user: string;
      path: string;
      type: string;
      from: string;
      repo: string;
      branch: string;
    },
    @Req() req: Request,
  ) {
    return await this.pagesService.directoryImport({
      baseId,
      body,
      user: req.user,
    });
  }
}
