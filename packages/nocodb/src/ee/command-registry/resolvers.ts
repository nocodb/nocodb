import type { NcContext } from '~/interface/config';
import type { ResolvedCtx } from './types';

/**
 * Anything with `.get(context, id) → { title?, ... }`. We don't import models
 * here — caller passes the model class so this file stays a thin utility.
 */
export interface ResolvableModel {
  get(
    context: NcContext,
    idOrParams: any,
    ...rest: any[]
  ): Promise<{ title?: string; [k: string]: any } | undefined>;
}

/**
 * P1: returns `{ parentEntityTitle: M(idKey).title }`.
 * Use when the contract's entity has a parent looked up by an ID
 * present on the params object (e.g. column → table via `tableId`).
 */
export const lookupParent =
  (idKey: string, M: ResolvableModel) =>
  async (context: NcContext, params: any): Promise<ResolvedCtx> => {
    const e = await M.get(context, params?.[idKey]);
    return { parentEntityTitle: e?.title };
  };

/**
 * P2: returns `{ entityTitle: M(idKey).title }`.
 * Use for update operations where the entity already exists; we need its
 * title for description rendering.
 */
export const lookupEntity =
  (idKey: string, M: ResolvableModel) =>
  async (context: NcContext, params: any): Promise<ResolvedCtx> => {
    const e = await M.get(context, params?.[idKey]);
    return { entityTitle: e?.title };
  };

/**
 * P3: returns `{ extra: { oldTitle: M(idKey).title } }`.
 * Use for delete/rename where the post-execution result has lost the title
 * we want to render in the changelog description.
 */
export const captureOldTitle =
  (idKey: string, M: ResolvableModel) =>
  async (context: NcContext, params: any): Promise<ResolvedCtx> => {
    const e = await M.get(context, params?.[idKey]);
    return { extra: { oldTitle: e?.title } };
  };

/**
 * P4: returns child + parent titles, with parent fetched via an FK on the
 * child. e.g. (viewId, View, 'fk_model_id', Model) → looks up View by ID,
 * then Table via View.fk_model_id.
 */
export const lookupEntityWithParent =
  (
    idKey: string,
    Child: ResolvableModel,
    parentFkField: string,
    Parent: ResolvableModel,
    opts?: { captureOldTitle?: boolean },
  ) =>
  async (context: NcContext, params: any): Promise<ResolvedCtx> => {
    const child = await Child.get(context, params?.[idKey]);
    if (!child) return {};
    const parent = child[parentFkField]
      ? await Parent.get(context, child[parentFkField])
      : undefined;
    return {
      entityTitle: child.title,
      parentEntityTitle: parent?.title,
      ...(opts?.captureOldTitle ? { extra: { oldTitle: child.title } } : {}),
    };
  };
