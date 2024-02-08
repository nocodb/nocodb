import { Global, Module } from '@nestjs/common';
import {
  GlobalModule as GlobalModuleEE,
  globalModuleMetadata as globalModuleMetadataEE,
} from 'src/modules/global/global.module';
import { LicenseService } from '~/service/license/license.service';

export const globalModuleMetadata = {
  ...globalModuleMetadataEE,
  providers: [...globalModuleMetadataEE.providers, LicenseService],
  exports: [...globalModuleMetadataEE.exports, LicenseService],
};

@Global()
@Module(globalModuleMetadata)
export class GlobalModule extends GlobalModuleEE {}
