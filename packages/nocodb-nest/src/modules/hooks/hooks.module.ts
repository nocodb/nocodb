import { Module } from '@nestjs/common';
import { HooksService } from '../../services/hooks.service';
import { HooksController } from '../../controllers/hooks.controller';

@Module({
  controllers: [HooksController],
  providers: [HooksService],
})
export class HooksModule {}
