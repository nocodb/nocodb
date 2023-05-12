import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UseAclMiddleware } from 'src/middlewares/extract-project-id/extract-project-id.middleware';
import { DocsPagesService } from 'src/services/docs/docs-pages.service';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class DocsPagesController {
  constructor(private readonly pagesService: DocsPagesService) {}

  @Get('/api/v1/docs/page/:id')
  @UseAclMiddleware({
    permissionName: 'pageGet',
  })
  async get(@Param('id') id: string, @Query('projectId') projectId: string) {
    return await this.pagesService.get({
      id,
      projectId,
    });
  }

  @Get('/api/v1/docs/page-parents')
  @UseAclMiddleware({
    permissionName: 'pageParents',
  })
  async parents(
    @Query('projectId') projectId: string,
    @Query('pageId') pageId: string,
  ) {
    return await this.pagesService.pageParents({
      projectId,
      pageId,
    });
  }

  @Get('/api/v1/docs/pages')
  @UseAclMiddleware({
    permissionName: 'pageList',
  })
  async list(@Query('projectId') projectId: string) {
    return await this.pagesService.list({
      projectId,
    });
  }

  @Post('/api/v1/docs/page/')
  @UseAclMiddleware({
    permissionName: 'pageCreate',
  })
  async create(
    @Body() body: { attributes: any; projectId: string },
    @Request() req,
  ) {
    return await this.pagesService.create({
      attributes: body.attributes,
      projectId: body.projectId,
      user: req.user,
    });
  }

  @Put('/api/v1/docs/page/:id')
  @UseAclMiddleware({
    permissionName: 'pageUpdate',
  })
  async update(
    @Param('id') id: string,
    @Body() body: { attributes: any; projectId: string },
    @Request() req,
  ) {
    return await this.pagesService.update({
      pageId: id,
      attributes: body.attributes,
      projectId: body.projectId,
      user: req.user,
      workspaceId: req.ncWorkspaceId,
    });
  }

  @Delete('/api/v1/docs/page/:id')
  @UseAclMiddleware({
    permissionName: 'pageDelete',
  })
  async delete(@Param('id') id: string, @Query('projectId') projectId: string) {
    return await this.pagesService.delete({
      id,
      projectId,
    });
  }

  @Post('/api/v1/docs/page/magic-expand')
  @UseAclMiddleware({
    permissionName: 'pageMagicExpand',
  })
  async magicExpand(
    @Body() body: { projectId: string; pageId: string; text: string },
  ) {
    return await this.pagesService.magicExpand({
      text: body.text,
      projectId: body.projectId,
      pageId: body.pageId,
    });
  }

  @Post('/api/v1/docs/page/magic-outline')
  @UseAclMiddleware({
    permissionName: 'pageMagicOutline',
  })
  async magicOutline(@Body() body: { projectId: string; pageId: string }) {
    return await this.pagesService.magicOutline({
      projectId: body.projectId,
      pageId: body.pageId,
    });
  }

  @Post('/api/v1/docs/page/magic')
  @UseAclMiddleware({
    permissionName: 'pageMagicCreate',
  })
  async magicCreate(
    @Body() body: { title: string; projectId: string; pageId: string },
    @Request() req,
  ) {
    return await this.pagesService.magicCreatePages({
      projectId: body.projectId,
      pageId: body.pageId,
      title: body.title,
      user: req.user,
    });
  }

  @Post('/api/v1/docs/page/import')
  @UseAclMiddleware({
    permissionName: 'pageImport',
  })
  async import(
    @Body()
    body: {
      user: string;
      path: string;
      type: string;
      from: string;
      repo: string;
      branch: string;
      projectId: string;
    },
    @Request() req,
  ) {
    return await this.pagesService.directoryImport({
      projectId: body.projectId,
      body,
      user: req.user,
    });
  }
}
