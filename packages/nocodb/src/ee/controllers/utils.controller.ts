import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UtilsController as UtilsControllerCE } from 'src/controllers/utils.controller';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { UtilsService } from '~/services/utils.service';

@Controller()
export class UtilsController extends UtilsControllerCE {
  constructor(protected readonly utilsService: UtilsService) {
    super(utilsService);
  }

  @Post('/api/v1/db/meta/magic')
  @UseGuards(GlobalGuard)
  @Acl('genericGPT')
  async genericGPT(@Body() body: any) {
    return await this.utilsService.genericGPT({
      body,
    });
  }
}
