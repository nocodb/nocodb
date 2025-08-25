import { promisify } from 'util';
import { OrgUserRoles } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { v4 as uuidv4 } from 'uuid';
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
      // 1. If the user signup still in progeress
      // 2. If the user is invited and yet to set password
      // 3. If the user is created via non email-password auth (OAuth)
      if (!user.salt) {
        return NcError.badRequest(
          'If signing up, wait to finish. If invited, use the email link. Otherwise, reset your password or contact the super admin.',
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

  async signup(createUserDto: CreateUserDto) {
    const { email: _email, firstname, lastname } = createUserDto as any;

    let { password } = createUserDto;

    const email = _email.toLowerCase();

    let user = await this.usersService.findOne(email);

    const salt = await promisify(bcrypt.genSalt)(10);
    password = await promisify(bcrypt.hash)(password, salt);
    const email_verification_token = uuidv4();

    if (!user) {
      await this.registerNewUserIfAllowed({
        firstname,
        lastname,
        email,
        salt,
        password,
        email_verification_token,
      });
    }
    user = await this.usersService.findOne(email);
    return await this.login(user);
  }

  async registerNewUserIfAllowed(
    {
      firstname,
      lastname,
      email,
      salt,
      password,
      email_verification_token,
    }: {
      firstname;
      lastname;
      email: string;
      salt: any;
      password;
      email_verification_token;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const roles: string = OrgUserRoles.CREATOR;

    const token_version = ''; // randomTokenString();

    return await this.usersService.insert(
      {
        firstname,
        lastname,
        email,
        salt,
        password,
        email_verification_token,
        roles,
        token_version,
      },
      ncMeta,
    );
  }
}
