import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { NcConfig } from '../../../interface/config';
import { OrgUserRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import { Store, User, Workspace, WorkspaceUser } from '../../models';
import { NC_APP_SETTINGS } from '../../constants';
import { NcError } from '../../meta/helpers/catchError';
import { T } from 'nc-help';

export function genJwt(user: User, config: NcConfig) {
  return jwt.sign(
    {
      email: user.email,
      avatar: user.avatar,
      display_name: user.display_name,
      user_name: user.user_name,
      id: user.id,
      roles: user.roles,
      token_version: user.token_version,
    },
    config.auth.jwt.secret,
    config.auth.jwt.options
  );
}

export function randomTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

export async function createDefaultWorkspace(user: User) {
  const title = `${user.email?.split('@')?.[0]}`;
  // create new workspace for user
  const workspace = await Workspace.insert({
    title,
    description: 'Default workspace',
    fk_user_id: user.id,
  });

  await WorkspaceUser.insert({
    fk_user_id: user.id,
    fk_workspace_id: workspace.id,
    roles: WorkspaceUserRoles.OWNER,
  });

  return workspace;
}

export async function registerNewUserIfAllowed({
  avatar,
  user_name,
  display_name,
  email,
  salt,
  password,
  email_verification_token,
  email_verified,
}: {
  avatar;
  user_name;
  display_name;
  email: string;
  salt: any;
  password;
  email_verification_token;
  email_verified?;
}) {
  let roles: string = OrgUserRoles.CREATOR;

  if (await User.isFirst()) {
    roles = `${OrgUserRoles.SUPER_ADMIN}`;
    // todo: update in nc_store
    // roles = 'owner,creator,editor'
    T.emit('evt', {
      evt_type: 'project:invite',
      count: 1,
    });
  } else {
    let settings: { invite_only_signup?: boolean } = {};
    try {
      settings = JSON.parse((await Store.get(NC_APP_SETTINGS))?.value);
    } catch {}

    if (settings?.invite_only_signup) {
      NcError.badRequest('Not allowed to signup, contact super admin.');
    } else {
      // roles = OrgUserRoles.VIEWER;
      // todo: handle in self-hosted
      roles = OrgUserRoles.CREATOR;
    }
  }

  const token_version = randomTokenString();

  const user = await User.insert({
    avatar,
    display_name,
    user_name,
    email,
    salt,
    password,
    email_verification_token,
    roles,
    token_version,
    email_verified,
  });

  await createDefaultWorkspace(user);
  return user;
}
