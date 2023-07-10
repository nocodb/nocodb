import {Controller, Post, UseGuards} from "@nestjs/common";
import {Acl} from "../../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware";


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
