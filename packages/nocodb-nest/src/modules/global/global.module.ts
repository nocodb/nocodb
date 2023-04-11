import { Global, Module } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { Connection } from '../../connection/connection'
import { MetaService } from '../../meta/meta.service'
import { jwtConstants } from '../auth/constants'

@Global()
@Module({
  imports: [

  ],
  providers: [
    Connection,
    MetaService,
  ],
  exports: [
    Connection,
    MetaService,
    // JwtService,
  ],
})
export class GlobalModule {
}
