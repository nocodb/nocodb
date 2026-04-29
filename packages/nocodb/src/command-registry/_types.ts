import type { z, ZodTypeAny } from 'zod';
import type { MetaTable } from '~/utils/globals';
import type { NcContext, NcRequest } from '~/interface/config';

export interface OperationContract<S extends ZodTypeAny = ZodTypeAny> {
  readonly name: string;
  readonly version: number;
  readonly entity: MetaTable;

  readonly schema: S;
  readonly extraSchema?: ZodTypeAny;

  readonly idField?: string;

  readonly entityId?: string | EntityRefFn<S>;
  readonly entityTitle?: string | EntityRefFn<S>;
  readonly parentId?: string | EntityRefFn<S>;
  readonly parentTitle?: string | EntityRefFn<S>;
  readonly description?: string | DescFn;

  readonly resolveCtx?: (ctx: NcContext, p: z.infer<S>) => Promise<ResolvedCtx>;
  readonly skipIf?: (
    ctx: NcContext,
    p: z.infer<S>,
    r: any,
    resolved?: ResolvedCtx,
  ) => Promise<boolean> | boolean;
  readonly deps?: (p: z.infer<S>, r: any) => TraceCommandDep[];
  readonly extraCommandMeta?: (p: z.infer<S>, r: any) => Record<string, any>;
}

export type EntityRefFn<S extends ZodTypeAny> = (
  p: z.infer<S>,
  r: any,
) => string | undefined;

export type ParamsOf<C> = C extends OperationContract<infer S> ? z.infer<S> : never;

export type CommandHandler<C extends OperationContract = OperationContract> = (
  ctx: NcContext,
  params: ParamsOf<C>,
  meta: HandlerMeta,
) => Promise<unknown>;

export interface HandlerMeta {
  entryId: string;
  entityId?: string;
  originalReq: NcRequest;
  createdBy: string;
  extra?: Record<string, unknown>;
}

export interface ChangelogCommandPayload {
  name: string;
  version: number;
  params: unknown;
  extra?: Record<string, unknown>;
}

export interface TraceCommandDep {
  entity: MetaTable;
  id: string;
}

export interface ResolvedCtx {
  entityTitle?: string;
  parentEntityTitle?: string;
  extra?: Record<string, any>;
}

export interface DescCtx {
  entityTitle?: string;
  parentEntityTitle?: string;
  operation: string;
  extra?: Record<string, any>;
}
export type DescFn = (ctx: DescCtx) => string;
