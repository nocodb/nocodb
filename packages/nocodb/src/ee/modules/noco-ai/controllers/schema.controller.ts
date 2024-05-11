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

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AiSchemaController {
  constructor(private readonly aiSchemaService: AiSchemaService) {}

  @Post(['/api/v2/ai/schema/:baseId'])
  @HttpCode(200)
  async generateSchema(
    @Req() req: Request,
    @Body() body,
    @Param('baseId') baseId: string,
  ) {
    const { input } = body;
    return await this.aiSchemaService.generateSchema({
      baseId,
      input,
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
    return await this.aiSchemaService.serializeExistingSchema({
      baseId,
      req,
    });
  }
}
