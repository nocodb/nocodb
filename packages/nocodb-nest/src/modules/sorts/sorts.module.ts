import { Module } from '@nestjs/common';
import { SortsService } from '../../services/sorts.service';
import { SortsController } from '../../controllers/sorts.controller';

@Module({
  controllers: [SortsController],
  providers: [SortsService],
})
export class SortsModule {}
