import { Controller, Post, Req } from '@nestjs/common';
import { TestService } from './test.service';
import { TestResetService } from './TestResetService';

@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Post('/api/v1/meta/test/reset')
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
