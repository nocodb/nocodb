import { Module } from '@nestjs/common';
import { GlobalModule } from '../global/global.module';
import { UsersService } from '../../services/users/users.service';
import { UsersController } from '../../controllers/users/users.controller';

@Module({
  imports: [GlobalModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
