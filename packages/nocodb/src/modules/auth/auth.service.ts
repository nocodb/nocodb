import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import Noco from '~/Noco';
import { genJwt } from '~/services/users/helpers';
import { UsersService } from '~/services/users/users.service';
import { NcError } from '~/helpers/ncError';

export class CreateUserDto {
  readonly username: string;
  readonly email: string;
  readonly password: string;
}

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    if (user) {
      const { password, salt, ...result } = user;

      // `salt` will be null,
      // 1. If the user is invited and yet to set password
      // 2. If the user is created via non email-password auth (OAuth)
      if (!user.salt) {
        return NcError.badRequest(
          'If invited, sign up via the email link; otherwise, use forgot password or contact the super admin.',
        );
      }

      const hashedPassword = await promisify(bcrypt.hash)(pass, user.salt);
      if (user.password === hashedPassword) {
        return result;
      }
    }
    return null;
  }

  async login(user: any) {
    delete user.password;
    delete user.salt;
    const payload = user;
    return {
      token: genJwt(payload, Noco.getConfig()),
    };
  }
}
