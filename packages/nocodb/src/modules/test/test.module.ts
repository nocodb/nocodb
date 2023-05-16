import { Module } from '@nestjs/common';
import { TestController } from '../../controllers/test/test.controller';

@Module({
  controllers: [
    ...(!process.env['NC_WORKER_CONTAINER'] ? [TestController] : []),
  ],
})
export class TestModule {}
