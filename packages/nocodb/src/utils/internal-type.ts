import type { MCPToken } from '~/models';

export type InternalGETResponseType = Promise<void | MCPToken | MCPToken[]>;

export type InternalPOSTResponseType = Promise<void | boolean | MCPToken>;
