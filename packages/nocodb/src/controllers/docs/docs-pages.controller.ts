import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DocsPageHistoryService } from '~/services/docs/history/docs-page-history.service';
import { UseAclMiddleware } from '../../middlewares/extract-project-id/extract-project-id.middleware';
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
  @UseAclMiddleware({
    permissionName: 'pageGet',
  })
  async get(@Param('id') id: string, @Param('projectId') projectId: string) {
    return await this.pagesService.get({
      id,
      projectId,
    });
  }

  @Get('/api/v1/docs/:projectId/pages')
  @UseAclMiddleware({
    permissionName: 'pageList',
  })
  async list(@Param('projectId') projectId: string) {
    return await this.pagesService.list({
      projectId,
    });
  }

  @Post('/api/v1/docs/:projectId/pages')
  @UseAclMiddleware({
    permissionName: 'pageCreate',
  })
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
  @UseAclMiddleware({
    permissionName: 'pageUpdate',
  })
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
  @UseAclMiddleware({
    permissionName: 'pageDelete',
  })
  async delete(@Param('id') id: string, @Param('projectId') projectId: string) {
    return await this.pagesService.delete({
      id,
      projectId,
    });
  }

  @Post('/api/v1/docs/:projectId/pages/:id/gpt')
  @UseAclMiddleware({
    permissionName: 'pageGpt',
  })
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
  @UseAclMiddleware({
    permissionName: 'docsMagicCreatePages',
  })
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
  @UseAclMiddleware({
    permissionName: 'pageImport',
  })
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
