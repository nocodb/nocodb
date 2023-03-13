import { OrgUserRoles } from 'nocodb-sdk';
import { T } from 'nc-help';
import { validatePayload } from '../meta/api/helpers';
import { NcError } from '../meta/helpers/catchError';
import ApiToken from '../models/ApiToken';
import type { ApiTokenReqType } from 'nocodb-sdk';
import type User from '../models/User';

export async function apiTokenList(param: { userId: string }) {
  return ApiToken.list(param.userId);
}
export async function apiTokenCreate(param: {
  userId: string;
  tokenBody: ApiTokenReqType;
}) {
  await validatePayload(
    'swagger.json#/components/schemas/ApiTokenReq',
    param.tokenBody
  );

  T.emit('evt', { evt_type: 'apiToken:created' });
  return ApiToken.insert({ ...param.tokenBody, fk_user_id: param.userId });
}

export async function apiTokenDelete(param: { token; user: User }) {
  const apiToken = await ApiToken.getByToken(param.token);
  if (
    !param.user.roles.includes(OrgUserRoles.SUPER_ADMIN) &&
    apiToken.fk_user_id !== param.user.id
  ) {
    NcError.notFound('Token not found');
  }
  T.emit('evt', { evt_type: 'apiToken:deleted' });

  // todo: verify token belongs to the user
  return await ApiToken.delete(param.token);
}
