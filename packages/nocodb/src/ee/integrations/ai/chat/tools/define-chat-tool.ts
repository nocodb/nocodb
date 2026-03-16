import type { z } from 'zod';
import type { ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import type { BasePermission } from '~/utils/acl';

export type ToolVisibility = 'hidden' | 'action' | 'data' | 'ui';

export type ToolCategory =
  | 'schema'
  | 'data'
  | 'view'
  | 'ui'
  | 'dashboard'
  | 'web'
  | 'sandbox'
  | 'interaction';

export interface ChatToolDefinition<
  T extends z.ZodObject<any> = z.ZodObject<any>,
  R = any,
> {
  name: ChatToolName;
  description: string;
  schema: T;
  visibility: ToolVisibility;
  category: ToolCategory;
  scope: 'base' | 'common';
  requiredRole: ProjectRoles | null;
  isDangerous: boolean;
  /** ACL permission key from acl.ts */
  permission?: BasePermission;
  readonly?: boolean;
  uiOnly?: boolean;
  execute: (context: NcContext, args: z.infer<T>, req: NcRequest) => Promise<R>;
  /**
   * Build metadata for this tool's result, attached to the tool_use block
   * for frontend rendering. Not sent to the AI — stripped by chat-agent.service.
   *
   * Receives the same context/args as execute(), plus the typed execute result.
   * Return undefined to skip metadata for this invocation.
   */
  buildMeta?: (
    context: NcContext,
    args: z.infer<T>,
    result: R,
  ) => Promise<Record<string, any> | undefined>;
}

export function defineChatTool<T extends z.ZodObject<any>, R = any>(
  def: ChatToolDefinition<T, R>,
): ChatToolDefinition<T, R> {
  return def;
}
