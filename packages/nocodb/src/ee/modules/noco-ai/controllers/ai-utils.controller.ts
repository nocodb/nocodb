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
import { AiUtilsService } from '~/modules/noco-ai/services/ai-utils.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AiUtilsController {
  constructor(private readonly aiUtilsService: AiUtilsService) {}

  @Post(['/api/v2/ai/:baseId/utils'])
  @HttpCode(200)
  async generateViews(
    @TenantContext() context: NcContext,
    @Req() req: Request,
    @Body()
    body: {
      operation: string;
      input: any;
    },
  ) {
    const { operation } = body;

    if (operation === 'predictFieldType') {
      return await this.aiUtilsService.predictFieldType(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'predictSelectOptions') {
      return await this.aiUtilsService.predictSelectOptions(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'predictNextFields') {
      return await this.aiUtilsService.predictNextFields(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'predictNextFormulas') {
      return await this.aiUtilsService.predictNextFormulas(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'generateTables') {
      return await this.aiUtilsService.generateTables(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'generateViews') {
      return await this.aiUtilsService.generateViews(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'predictNextTables') {
      return await this.aiUtilsService.predictNextTables(context, {
        input: body.input,
        req,
      });
    }
  }
}
