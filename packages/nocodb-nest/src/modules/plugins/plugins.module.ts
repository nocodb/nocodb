import { Module } from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { PluginsController } from './plugins.controller';

@Module({
  controllers: [PluginsController],
  providers: [PluginsService],
})
export class PluginsModule {}
