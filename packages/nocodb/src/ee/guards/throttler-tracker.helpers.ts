import * as jwt from 'jsonwebtoken';
import type { NcRequest } from 'nocodb-sdk';
import { ApiToken } from '~/models';
import { getApiTokenFromHeader } from '~/helpers';

const HEADER_NAME_GUI = 'xc-auth';

/** Decode the xc-auth JWT (no verify) and return the `id` claim. */
export function decodeXcAuthUserId(req: NcRequest): string | null {
  const xcAuth = req.headers[HEADER_NAME_GUI] as string | undefined;
  if (!xcAuth) return null;
  const payload = jwt.decode(xcAuth);
  if (payload && typeof payload === 'object' && (payload as any).id) {
    return (payload as any).id as string;
  }
  return null;
}

/** Resolve an API token's user via NocoCache-backed lookup. */
export async function resolveApiTokenUserId(
  req: NcRequest,
): Promise<string | null> {
  const tokenStr = getApiTokenFromHeader(req);
  if (!tokenStr) return null;
  const apiToken = await ApiToken.getByToken(tokenStr);
  return apiToken?.fk_user_id ?? null;
}
