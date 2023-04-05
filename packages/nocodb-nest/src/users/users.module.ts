import { Module } from '@nestjs/common';
import { Connection } from '../connection/connection'
import { MetaService } from '../meta/meta.service'
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, MetaService, Connection],
  exports: [UsersService, Connection, MetaService],
})
export class UsersModule {}
