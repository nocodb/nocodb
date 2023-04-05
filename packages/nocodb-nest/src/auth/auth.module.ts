import { Module } from '@nestjs/common';
import { LocalStrategy } from '../local.strategy/local.strategy'
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from "../users/users.module";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from '@nestjs/passport';
import { jwtConstants } from "./constants";

@Module({
  controllers: [AuthController],

  imports:[
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '60s' },
    }),
  ],
  providers: [AuthService, LocalStrategy],
})
export class AuthModule {}
