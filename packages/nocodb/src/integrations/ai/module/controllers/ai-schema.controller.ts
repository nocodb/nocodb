import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BasesService } from '~/services/bases.service';
import { isEE } from '~/utils';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AiSchemaController {
  constructor(
    private readonly aiSchemaService: AiSchemaService,
    private readonly basesService: BasesService,
  ) {}

  @Post(['/api/v2/ai/:baseId/schema'])
  @Acl('aiBaseSchema', {
    scope: 'base',
  })
  @HttpCode(200)
  async aiSchema(
    @TenantContext() context: NcContext,
    @Req() req: Request,
    @Body()
    body: {
      operation: string;
      input: any;
    },
  ) {
    const { operation } = body;

    if (operation === 'generateTables') {
      const { title, description } = body.input;

      return await this.aiSchemaService.generateTables(context, {
        baseId: context.base_id,
        input: title,
        instructions: description,
        req: req,
      });
    } else if (operation === 'predictViews') {
      const { tableId, history = [], description, type } = body.input;

      return await this.aiSchemaService.predictViews(context, {
        baseId: context.base_id,
        tableIds: [tableId],
        history,
        instructions: description,
        type,
        req: req,
      });
    } else if (operation === 'createViews') {
      const { views } = body.input;

      const base = await this.basesService.getProject(context, {
        baseId: context.base_id,
      });

      return await this.aiSchemaService.createViews(context, {
        base,
        views,
        req: req,
      });
    } else if (operation === 'predictSchema') {
      return await this.aiSchemaService.predictSchema(context, {
        input: body.input,
        req: req,
      });
    } else if (operation === 'createSchema') {
      const { input } = body.input;

      const base = await this.basesService.baseCreate({
        base: {
          title: input.title.trim().substring(0, 50),
          type: 'database',
          ...(context.workspace_id
            ? { fk_workspace_id: context.workspace_id }
            : {}),
        },
        user: { id: req.user.id },
        req: req,
      });

      context.base_id = base.id;

      return await this.aiSchemaService.createSchema(context, {
        baseId: context.base_id,
        schema: body.input,
        req: req,
      });
    }
  }

  @Post(['/api/v2/ai/schema/:workspaceId'])
  @Acl('aiSchema', isEE ? { scope: 'workspace' } : { scope: 'org' })
  @HttpCode(200)
  async aiSchemaCreate(
    @TenantContext() context: NcContext,
    @Req() req: Request,
    @Body()
    body: {
      operation: string;
      input: any;
    },
  ) {
    const { operation } = body;

    if (operation === 'predictSchema') {
      return await this.aiSchemaService.predictSchema(context, {
        input: body.input,
        req: req,
      });
    } else if (operation === 'createSchema') {
      const { input } = body;

      if (!input.title) {
        throw new Error('Title is required');
      }

      const base = await this.basesService.baseCreate({
        base: {
          title: input.title.trim().substring(0, 50),
          type: 'database',
          ...(context.workspace_id
            ? { fk_workspace_id: context.workspace_id }
            : {}),
        },
        user: { id: req.user.id },
        req: req,
      });

      context.base_id = base.id;

      return await this.aiSchemaService.createSchema(context, {
        baseId: context.base_id,
        schema: body.input,
        req: req,
      });
    }
  }

  /*
  @Post(['/api/v2/ai/template/:workspaceId'])
  @HttpCode(200)
  @Acl('baseCreate', {
    scope: 'workspace',
  })
  async generateTemplate(
    @TenantContext() context: NcContext,
    @Req() req: Request,
    @Body()
    body: {
      input: string;
      instructions?: string;
      options?: {
        generateViews?: boolean;
        generateData?: boolean;
      };
    },
    @Param('workspaceId') workspaceId: string,
  ) {
    const { input, instructions } = body;
    const base = await this.basesService.baseCreate({
      base: {
        title: input.trim().substring(0, 50),
        type: 'database',
        ...({ fk_workspace_id: workspaceId } || {}),
      },
      user: { id: req.user.id },
      req: req,
    });

    context.base_id = base.id;

    await this.aiSchemaService.predictSchema(context, {
      baseId: base.id,
      input,
      instructions,
      req,
    });

    if (body.options?.generateViews) {
      await this.aiSchemaService.generateViews(context, {
        baseId: base.id,
        instructions,
        req,
      });
    }

    if (body.options?.generateData) {
      await this.aiSchemaService.generateData(context, {
        baseId: base.id,
        instructions,
        req,
      });
    }

    return base;
  }
  */
}
