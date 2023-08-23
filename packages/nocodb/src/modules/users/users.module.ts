import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategyProvider } from '~/strategies/google.strategy/google.strategy';
import { GlobalModule } from '~/modules/global/global.module';
import { UsersService } from '~/services/users/users.service';
import { UsersController } from '~/controllers/users/users.controller';
import { MetasModule } from '~/modules/metas/metas.module';

@Module({
  imports: [
    forwardRef(() => GlobalModule),
    PassportModule,
    forwardRef(() => MetasModule),
  ],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [UsersController] : []),
  ],
  providers: [UsersService, GoogleStrategyProvider],
  exports: [UsersService],
})
export class UsersModule {}
