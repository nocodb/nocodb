import { Controller, Get, Request, Param } from '@nestjs/common';
import { PublicMetasService } from './public-metas.service';

@Controller('public-metas')
export class PublicMetasController {
  constructor(private readonly publicMetasService: PublicMetasService) {}

  @Get('/api/v1/db/public/shared-view/:sharedViewUuid/meta')
  async viewMetaGet(
    @Request() req,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    return await this.publicMetasService.viewMetaGet({
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
    });
  }

  @Get('/api/v1/db/public/shared-base/:sharedBaseUuid/meta')
  async publicSharedBaseGet(
    @Param('sharedBaseUuid') sharedBaseUuid: string,
  ): Promise<any> {
    return await this.publicMetasService.publicSharedBaseGet({
      sharedBaseUuid,
    });
  }
}
