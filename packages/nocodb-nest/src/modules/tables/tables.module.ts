import { Module } from '@nestjs/common';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';

@Module({
  controllers: [TablesController],
  providers: [TablesService]
})
export class TablesModule {}
