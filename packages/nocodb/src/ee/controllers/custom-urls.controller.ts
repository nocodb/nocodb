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
    @Query() queryParams: Record<string, any>,
  ) {
    const originalPath = await this.customUrlsService.getOriginalPath(
      customPath,
    );

    if (originalPath) {
      const urlParams = new URLSearchParams();

      // Append the original path as 'hash-redirect'
      urlParams.append('hash-redirect', originalPath);

      // Add query params only if it is nocodb form
      // URL encode the queryParams to ensure they are passed correctly as a string
      if (originalPath.includes('/form/')) {
        const encodedQueryParams = encodeURIComponent(
          new URLSearchParams(queryParams).toString(),
        );

        urlParams.append('hash-query-params', encodedQueryParams);
      }

      // Redirect with the combined query parameters
      res.redirect(`${process.env.NC_DASHBOARD_URL}?${urlParams.toString()}`);
    }
  }

  @Post(['/api/v2/meta/custom-url/check-path'])
  @HttpCode(200)
  async checkAvailability(@Body() body: { id?: string; custom_path?: string }) {
    return await this.customUrlsService.checkAvailability(body);
  }
}
