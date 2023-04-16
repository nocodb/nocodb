import { Module } from '@nestjs/common';
import { KanbansService } from '../../services/kanbans.service';
import { KanbansController } from '../../controllers/kanbans.controller';

@Module({
  controllers: [KanbansController],
  providers: [KanbansService],
})
export class KanbansModule {}
