import { Module } from '@nestjs/common';
import { SharedBasesService } from './shared-bases.service';
import { SharedBasesController } from './shared-bases.controller';

@Module({
  controllers: [SharedBasesController],
  providers: [SharedBasesService]
})
export class SharedBasesModule {}
