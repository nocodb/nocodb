import { ExtractProjectIdMiddleware } from '../../middlewares/extract-project-id/extract-project-id.middleware'
import extractRolesObj from '../../utils/extractRolesObj'
import { AuthService } from './auth.service';

import { Controller, Request, Post, UseGuards, Body, Get } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport';


export class CreateUserDto {
  readonly username: string;
  readonly email: string;
  readonly password: string;
}


@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('/api/v1/auth/user/signin')
  async signin(@Request() req) {
    return this.authService.login(req.user);
  }


  @Post('/api/v1/auth/user/signup')
  async signup(@Body() createUserDto: CreateUserDto) {
    const user = await this.authService.signup(createUserDto);

  }

  @UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
  @Get('/api/v1/auth/user/me')
  async me(@Request() req) {
    const user = {
      ...req.user,
      roles: extractRolesObj(req.user.roles)
    }
    return user
  }
}
