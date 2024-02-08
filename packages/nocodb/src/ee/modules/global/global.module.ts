import { Global, Module } from '@nestjs/common';
import {
  GlobalModule as GlobalModuleCE,
  globalModuleMetadata as globalModuleMetadataCE,
} from 'src/modules/global/global.module';
import { Producer } from '~/services/producer/producer';
import { ProducerProvider } from '~/services/producer';

export const globalModuleMetadata = {
  ...globalModuleMetadataCE,
  providers: [
    ...globalModuleMetadataCE.providers,
    ProducerProvider,
  ],
  exports: [...globalModuleMetadataCE.exports, Producer],
}

@Global()
@Module(globalModuleMetadata)
export class GlobalModule extends GlobalModuleCE {}
