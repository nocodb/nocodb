import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { CustomUrlsService } from '~/services/custom-urls.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CustomUrlsController {
  constructor(protected readonly customUrlsService: CustomUrlsService) {}

  @Get(['/api/v2/meta/custom-url/get-by-id/:id'])
  async getCustomUrl(@Param('id') id: string) {
    return await this.customUrlsService.get(id);
  }

  @Get(['/p/:customPath'])
  async getOriginalPath(
    @Param('customPath') customPath: string,
    @Res() res: Response,
  ) {
    const originalPath = await this.customUrlsService.getOriginalPath(
      customPath,
    );

    if (originalPath) {
      const urlParams = new URLSearchParams();

      // add query params to the original path
      urlParams.append('hash-redirect', originalPath);

      // add redirect query param with the original path
      res.redirect(`${process.env.NC_DASHBOARD_URL}?${urlParams.toString()}`);
    }
  }

  @Post(['/api/v2/meta/custom-url/check-path'])
  @HttpCode(200)
  async checkAvailability(@Body() body: { id?: string; custom_path?: string }) {
    return await this.customUrlsService.checkAvailability(body);
  }
}
