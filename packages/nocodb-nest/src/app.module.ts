import { Module } from '@nestjs/common';
import { Connection } from './connection/connection';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MetaService } from './meta/meta.service';
import { LocalStrategy } from './local.strategy/local.strategy';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [],
  providers: [Connection, MetaService, LocalStrategy],
})
export class AppModule {}
