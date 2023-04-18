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
import { GlobalGuard } from '../guards/global/global.guard';
import extractRolesObj from '../utils/extractRolesObj';
import { AuthService } from '../services/auth.service';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';

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
  @HttpCode(200)
  async signin(@Request() req) {
    return this.authService.login(req.user);
  }

  @Post('/api/v1/auth/user/signup')
  @HttpCode(200)
  async signup(@Body() createUserDto: CreateUserDto) {
    return await this.authService.signup(createUserDto);
  }

  @UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
  @Get('/api/v1/auth/user/me')
  async me(@Request() req) {
    const user = {
      ...req.user,
      roles: extractRolesObj(req.user.roles),
    };
    return user;
  }
}
