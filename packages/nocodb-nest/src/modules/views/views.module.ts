import { Module } from '@nestjs/common';
import { TablesModule } from '../tables/tables.module';
import { ViewsService } from '../../services/views.service';
import { ViewsController } from '../../controllers/views.controller';

@Module({
  controllers: [ViewsController],
  providers: [ViewsService],
  imports: [TablesModule],
})
export class ViewsModule {}
