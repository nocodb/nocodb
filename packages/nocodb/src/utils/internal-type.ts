import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { MCPToken } from '~/models';
import type Dashboard from '~/models/Dashboard';
import type Widget from '~/models/Widget';

export type InternalGETResponseType = Promise<
  | void
  | MCPToken
  | MCPToken[]
  | PagedResponseImpl<any>
  | Dashboard
  | Dashboard[]
  | Widget
  | Widget[]
>;

export type InternalPOSTResponseType = Promise<
  void | boolean | MCPToken | Dashboard | Widget
>;
