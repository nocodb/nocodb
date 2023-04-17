import { Module } from '@nestjs/common';
import { TestController } from '../../controllers/test/test.controller';

@Module({
  controllers: [TestController],
})
export class TestModule {}
