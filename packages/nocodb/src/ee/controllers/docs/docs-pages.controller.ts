import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DocsPageHistoryService } from '~/services/docs/history/docs-page-history.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DocsPagesService } from '~/services/docs/docs-pages.service';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class DocsPagesController {
  private logger = new Logger(DocsPagesController.name);

  constructor(
    private readonly pagesService: DocsPagesService,
    private readonly pageHistoryService: DocsPageHistoryService,
  ) {}

  @Get('/api/v1/docs/:projectId/pages/:id')
  @Acl('pageGet')
  async get(@Param('id') id: string, @Param('projectId') projectId: string) {
    return await this.pagesService.get({
      id,
      projectId,
    });
  }

  @Get('/api/v1/docs/:projectId/pages')
  @Acl('pageList')
  async list(@Param('projectId') projectId: string) {
    return await this.pagesService.list({
      projectId,
    });
  }

  @Post('/api/v1/docs/:projectId/pages')
  @Acl('pageCreate')
  async create(
    @Param('projectId') projectId: string,
    @Body() body: { attributes: any },
    @Request() req,
  ) {
    const page = await this.pagesService.create({
      attributes: body.attributes,
      projectId,
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

  @Put('/api/v1/docs/:projectId/pages/:id')
  @Acl('pageUpdate')
  async update(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Body() body: { attributes: any },
    @Request() req,
  ) {
    return await this.pagesService.update({
      pageId: id,
      attributes: body.attributes,
      projectId,
      user: req.user,
      workspaceId: req.ncWorkspaceId,
    });
  }

  @Delete('/api/v1/docs/:projectId/pages/:id')
  @Acl('pageDelete')
  async delete(@Param('id') id: string, @Param('projectId') projectId: string) {
    return await this.pagesService.delete({
      id,
      projectId,
    });
  }

  @Post('/api/v1/docs/:projectId/pages/:id/gpt')
  @Acl('pageGpt')
  async gpt(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @Response() response,
    @Request() req,
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
      projectId,
      response,
    });
  }

  @Post('/api/v1/docs/:projectId/gpt')
  @Acl('docsMagicCreatePages')
  async gptCreatePages(
    @Param('projectId') projectId: string,
    @Body() body: { text: string },
    @Request() req,
  ) {
    return await this.pagesService.magicCreatePages({
      projectId,
      title: body.text,
      user: req.user,
    });
  }

  @Post('/api/v1/docs/:projectId/import')
  @Acl('pageImport')
  async import(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      user: string;
      path: string;
      type: string;
      from: string;
      repo: string;
      branch: string;
    },
    @Request() req,
  ) {
    return await this.pagesService.directoryImport({
      projectId,
      body,
      user: req.user,
    });
  }
}
