import { Global, Module } from '@nestjs/common';
import {
  GlobalModule as GlobalModuleCE,
  globalModuleMetadata,
} from 'src/modules/global/global.module';
import { Producer } from '~/services/producer/producer';
import { ProducerProvider } from '~/services/producer';

@Global()
@Module({
  ...globalModuleMetadata,
  providers: [...globalModuleMetadata.providers, ProducerProvider],
  exports: [...globalModuleMetadata.exports, Producer],
})
export class GlobalModule extends GlobalModuleCE {}
