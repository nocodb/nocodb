import { Module } from '@nestjs/common';
import { GoogleStrategy, GoogleStrategyProvider } from '../../strategies/google.strategy/google.strategy'
import { GlobalModule } from '../global/global.module';
import { UsersService } from '../../services/users/users.service';
import { UsersController } from '../../controllers/users/users.controller';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [GlobalModule, PassportModule],
  controllers: [UsersController],
  providers: [UsersService, GoogleStrategyProvider],
  exports: [UsersService],
})
export class UsersModule {}
