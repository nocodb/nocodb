import { Module } from '@nestjs/common';
import { TablesService } from '../../services/tables.service';
import { TablesController } from '../../controllers/tables.controller';

@Module({
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
