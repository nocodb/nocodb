import {
  Body,
  Controller,
  HttpCode,
  Param,
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
import { BasesService } from '~/services/bases.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AiSchemaController {
  constructor(
    private readonly aiSchemaService: AiSchemaService,
    private readonly basesService: BasesService,
  ) {}

  @Post(['/api/v2/ai/:baseId/schema'])
  @Acl('aiSchema', {
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
    } else if (operation === 'generateViews') {
      const { tableId } = body.input;

      return await this.aiSchemaService.generateViews(context, {
        baseId: context.base_id,
        tableIds: [tableId],
        req: req,
      });
    }
  }

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

    await this.aiSchemaService.generateSchema(context, {
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
}
