import { Module } from '@nestjs/common';
import { ColumnsService } from '../../services/columns.service';
import { ColumnsController } from '../../controllers/columns.controller';

@Module({
  controllers: [ColumnsController],
  providers: [ColumnsService],
})
export class ColumnsModule {}
