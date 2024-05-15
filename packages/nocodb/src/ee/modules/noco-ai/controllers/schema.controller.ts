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
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { AiSchemaService } from '~/modules/noco-ai/services/schema.service';
import { BasesService } from '~/services/bases.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AiSchemaController {
  constructor(
    private readonly aiSchemaService: AiSchemaService,
    private readonly basesService: BasesService,
  ) {}

  @Post(['/api/v2/ai/schema/:baseId'])
  @HttpCode(200)
  async generateSchema(
    @Req() req: Request,
    @Body()
    body: {
      input: string;
    },
    @Param('baseId') baseId: string,
  ) {
    const { input } = body;
    return await this.aiSchemaService.generateSchema({
      baseId,
      input,
      req,
    });
  }

  @Post(['/api/v2/ai/schema/:baseId/views'])
  @HttpCode(200)
  async generateViews(@Req() req: Request, @Param('baseId') baseId: string) {
    return await this.aiSchemaService.generateViews({
      baseId,
      req,
    });
  }

  @Post(['/api/v2/ai/schema/:baseId/preview'])
  @HttpCode(200)
  async generateSchemaPreview(
    @Req() req: Request,
    @Body() body,
    @Param('baseId') baseId: string,
  ) {
    return await this.aiSchemaService.serializeSchema({
      baseId,
      req,
    });
  }

  @Post(['/api/v2/ai/template/:workspaceId'])
  @HttpCode(200)
  async generateTemplate(
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

    await this.aiSchemaService.generateSchema({
      baseId: base.id,
      input,
      instructions,
      req,
    });

    if (body.options?.generateViews) {
      await this.aiSchemaService.generateViews({
        baseId: base.id,
        instructions,
        req,
      });
    }

    if (body.options?.generateData) {
      await this.aiSchemaService.generateData({
        baseId: base.id,
        instructions,
        req,
      });
    }

    return base;
  }
}
