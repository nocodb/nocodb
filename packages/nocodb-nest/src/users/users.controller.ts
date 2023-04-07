import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

@Get('/api/v1/auth/user/me')
  async me() {
    // return this.usersService.me();
  }

}
