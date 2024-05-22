import { nocoModuleEeMetadata } from 'src/ee/modules/noco.module';
import { Module } from '@nestjs/common';
import { LicenseService } from '~/services/license/license.service';

@Module({
  imports: [...nocoModuleEeMetadata.imports],
  providers: [...nocoModuleEeMetadata.providers, LicenseService],
  controllers: [...nocoModuleEeMetadata.controllers],
  exports: [...nocoModuleEeMetadata.exports],
})
export class NocoModule {}
