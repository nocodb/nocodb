import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
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
  // Pre-computed dummy hash to ensure constant-time response when user is not found
  static readonly DUMMY_HASH =
    '$2a$10$DwEv0MjMRZdMnOFRMChjHuq3YNKhMfSEPkNRCQsGx0KGfcIUNEz2W';

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

      const valid = await promisify(bcrypt.compare)(pass, user.password);
      if (valid) {
        return result;
      }
    } else {
      // Perform a dummy compare with a random prefix to prevent timing-based user enumeration
      await promisify(bcrypt.compare)(pass, AuthService.DUMMY_HASH);
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
