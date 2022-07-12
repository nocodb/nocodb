import * as jwt from 'jsonwebtoken';
import User from '../../../models/User';
import { NcConfig } from '../../../../interface/config';

export function genJwt(user: User, config: NcConfig) {
  return jwt.sign(
    {
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      id: user.id,
      roles: user.roles,
      token_version: user.token_version
    },
    config.auth.jwt.secret,
    config.auth.jwt.options
  );
}
