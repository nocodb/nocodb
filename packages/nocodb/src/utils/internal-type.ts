import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { MCPToken, OAuthClient } from '~/models';
import type {
  TeamDetailV3Type,
  TeamMemberV3ResponseType,
  TeamV3ResponseType,
} from '~/services/v3/teams-v3.types';

export type InternalGETResponseType = Promise<
  | void
  | MCPToken
  | MCPToken[]
  | PagedResponseImpl<any>
  | OAuthClient
  | OAuthClient[]
  | { list: TeamV3ResponseType[] }
  | TeamDetailV3Type
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | MCPToken
  | OAuthClient
  | OAuthClient[]
  | TeamV3ResponseType
  | TeamMemberV3ResponseType[]
  | { msg: string }
>;
