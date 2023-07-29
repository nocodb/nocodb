import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { UtilsService } from '~/services/utils.service';

@Controller()
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Post('/api/v1/db/meta/magic')
  @UseGuards(GlobalGuard)
  @Acl('genericGPT')
  async genericGPT(@Body() body: any) {
    return await this.utilsService.genericGPT({
      body,
    });
  }
}
