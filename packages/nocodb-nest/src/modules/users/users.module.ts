import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GlobalModule } from '../global/global.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [GlobalModule],
  controllers: [UsersController],
  providers: [UsersService, JwtService],
  exports: [UsersService],
})
export class UsersModule {}
