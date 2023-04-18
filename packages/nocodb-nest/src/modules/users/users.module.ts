import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategyProvider } from '../../strategies/google.strategy/google.strategy';
import { GlobalModule } from '../global/global.module';
import { UsersService } from '../../services/users/users.service';
import { UsersController } from '../../controllers/users/users.controller';
import { OpenidStrategyProvider } from '../../strategies/openid.strategy/openid.strategy';

@Module({
  imports: [GlobalModule, PassportModule],
  controllers: [UsersController],
  providers: [UsersService, GoogleStrategyProvider, OpenidStrategyProvider],
  exports: [UsersService],
})
export class UsersModule {}
