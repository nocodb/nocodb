import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategyProvider } from '~/strategies/google.strategy/google.strategy';
import { GlobalModule } from '~/modules/global/global.module';
import { UsersService } from '~/services/users/users.service';
import { UsersController } from '~/controllers/users/users.controller';

@Module({
  imports: [GlobalModule, PassportModule],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [UsersController] : []),
  ],
  providers: [UsersService, GoogleStrategyProvider],
  exports: [UsersService],
})
export class UsersModule {}
