import { Module } from '@nestjs/common';
import { Connection } from './connection/connection';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MetaService } from './meta/meta.service';
import { LocalStrategy } from './local.strategy/local.strategy';
import { UtilsModule } from './utils/utils.module';

@Module({
  imports: [AuthModule, UsersModule, UtilsModule],
  controllers: [],
  providers: [Connection, MetaService],
  exports: [Connection, MetaService],
})
export class AppModule {}
