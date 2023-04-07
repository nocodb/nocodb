import { Controller, Get, Request, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { UsersService } from './users.service'

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/api/v1/auth/user/me')
  async me(@Request() req) {
    return req.user
  }
}
