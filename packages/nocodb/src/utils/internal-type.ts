import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { MCPToken, OAuthClient } from '~/models';

export type InternalGETResponseType = Promise<
  | void
  | MCPToken
  | MCPToken[]
  | PagedResponseImpl<any>
  | OAuthClient
  | OAuthClient[]
>;

export type InternalPOSTResponseType = Promise<
  void | boolean | MCPToken | OAuthClient | OAuthClient[] | { msg: string }
>;
