import { BasicStrategy as Strategy } from 'passport-http';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';

@Injectable()
export class BasicStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService<AppConfig>) {
    super({
      passReqToCallback: true,
    });
  }

  public validate = async (req, username, password): Promise<boolean> => {
    const credentials = this.configService.get('basicAuth', {
      infer: true,
    });
    if (
      credentials.username === username &&
      credentials.password === password
    ) {
      return true;
    }
    throw new UnauthorizedException();
  };
}
