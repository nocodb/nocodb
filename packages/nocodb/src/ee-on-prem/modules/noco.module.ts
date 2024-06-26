import { nocoModuleEeMetadata } from 'src/ee/modules/noco.module';
import { Module } from '@nestjs/common';
import { LicenseService } from '../services/license/license.service';

@Module({
  ...nocoModuleEeMetadata,
  imports: [...nocoModuleEeMetadata.imports],
  providers: [...nocoModuleEeMetadata.providers, LicenseService],
  controllers: [...nocoModuleEeMetadata.controllers],
  exports: [...nocoModuleEeMetadata.exports, LicenseService],
})
export class NocoModule {}
