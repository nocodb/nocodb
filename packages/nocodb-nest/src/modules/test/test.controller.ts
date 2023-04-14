import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { TestService } from './test.service';
import { TestResetService } from './TestResetService';

@Controller()
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Post('/api/v1/meta/test/reset')
  @HttpCode(200)
  async reset(@Req() req) {
    const service = new TestResetService({
      parallelId: req.body.parallelId,
      dbType: req.body.dbType,
      isEmptyProject: req.body.isEmptyProject,
      workerId: req.body.workerId,
    });

    return await service.process();
  }
}
