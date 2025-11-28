import { nocoModuleEeMetadata } from 'src/ee/modules/noco.module';
import { Module } from '@nestjs/common';

@Module({
  ...nocoModuleEeMetadata,
  imports: [...nocoModuleEeMetadata.imports],
  providers: [...nocoModuleEeMetadata.providers],
  controllers: [...nocoModuleEeMetadata.controllers],
  exports: [...nocoModuleEeMetadata.exports],
})
export class NocoModule {}
