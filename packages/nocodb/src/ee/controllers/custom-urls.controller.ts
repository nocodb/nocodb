import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { License } from '~/decorators/license.decorator';
import { CustomUrlsService } from '~/services/custom-urls.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@License('custom-urls')
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
    @Query() queryParams: Record<string, any>,
  ) {
    const originalPath = await this.customUrlsService.getOriginalPath(
      customPath,
    );

    if (originalPath) {
      let redirectUrl = originalPath.startsWith('/')
        ? originalPath
        : `/${originalPath}`;

      // Append query params for forms
      if (originalPath.includes('/form/')) {
        const qs = new URLSearchParams(queryParams).toString();
        if (qs) {
          redirectUrl += `?${qs}`;
        }
      }

      return res.redirect(redirectUrl);
    }

    // Redirect to not found page
    return res.redirect('/error/404');
  }

  @Post(['/api/v2/meta/custom-url/check-path'])
  @HttpCode(200)
  async checkAvailability(@Body() body: { id?: string; custom_path?: string }) {
    return await this.customUrlsService.checkAvailability(body);
  }
}
