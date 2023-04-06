import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { UsersService } from '../users/users.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private userService: UsersService) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromHeader('xc-auth'),
    });
  }

  async validate(payload: any) {
    const user = await this.userService.findOne(payload?.email);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
