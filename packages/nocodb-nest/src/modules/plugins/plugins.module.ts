import { Module } from '@nestjs/common';
import { PluginsService } from '../../services/plugins.service';
import { PluginsController } from '../../controllers/plugins.controller';

@Module({
  controllers: [PluginsController],
  providers: [PluginsService],
})
export class PluginsModule {}
