import { Global, Module } from '@nestjs/common'
import { Connection } from '../../connection/connection'
import { MetaService } from '../../meta/meta.service'

@Global()
@Module({
  providers:[
    Connection,
    MetaService
  ],
exports: [
    Connection,
    MetaService
  ]
})
export class GlobalModule {}
