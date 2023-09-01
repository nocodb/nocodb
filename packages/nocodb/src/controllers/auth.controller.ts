import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { AuthService } from '~/services/auth.service';
import { NcError } from '~/helpers/catchError';
import extractRolesObj from '~/utils/extractRolesObj';

export class CreateUserDto {
  readonly username: string;
  readonly email: string;
  readonly password: string;
}

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('/api/v1/auth/user/signin')
  @HttpCode(200)
  async signin(@Request() req) {
    if (this.config.get('auth', { infer: true }).disableEmailAuth) {
      NcError.forbidden('Email authentication is disabled');
    }
    return await this.authService.login(req.user);
  }

  @Post('/api/v1/auth/user/signup')
  @HttpCode(200)
  async signup(@Body() createUserDto: CreateUserDto) {
    if (this.config.get('auth', { infer: true }).disableEmailAuth) {
      NcError.forbidden('Email authentication is disabled');
    }
    return await this.authService.signup(createUserDto);
  }

  @UseGuards(GlobalGuard)
  @Get('/api/v1/auth/user/me')
  async me(@Request() req) {
    const user = {
      ...req.user,
      roles: extractRolesObj(req.user.roles),
    };
    return user;
  }
}
