import { AuthService } from './auth.service';

import { Controller, Request, Post, UseGuards, Body } from "@nestjs/common";
import { AuthGuard } from '@nestjs/passport';


export class CreateUserDto {
  readonly username: string;
  readonly email: string;
  readonly password: string;
}


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('signin')
  async signin(@Request() req) {
    return this.authService.login(req.user);
  }


  @Post('signup')
  async signup(@Body() createUserDto: CreateUserDto) {
    const user = await this.authService.signup(createUserDto);

  }

}
