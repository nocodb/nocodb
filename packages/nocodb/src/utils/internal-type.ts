import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { MCPToken } from '~/models';

export type InternalGETResponseType = Promise<
  void | MCPToken | MCPToken[] | PagedResponseImpl<any>
>;

export type InternalPOSTResponseType = Promise<void | boolean | MCPToken>;
