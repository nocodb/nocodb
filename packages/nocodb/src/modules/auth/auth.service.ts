import { promisify } from 'util';
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import Noco from '~/Noco';
import { genJwt } from '~/services/users/helpers';
import { UsersService } from '~/services/users/users.service';

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

    // Invited and Google/SSO accounts have no password; fail them like a wrong one, timing included.
    const hasPassword = !!(user?.salt && user.password);

    const valid = await promisify(bcrypt.compare)(
      pass,
      hasPassword ? user.password : AuthService.DUMMY_HASH,
    );

    if (hasPassword && valid) {
      const { password, salt, ...result } = user;
      return result;
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
