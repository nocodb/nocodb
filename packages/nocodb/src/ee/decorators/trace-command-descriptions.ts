/**
 * Bold-wrap a title for changelog descriptions.
 * Returns '' for undefined/empty so callers don't need to guard.
 */
export const b = (t?: string) => (t ? `**${t}**` : '');

/**
 * Context passed to description functions.
 * `entityTitle` and `parentEntityTitle` are resolved from TraceCommand options + prefetch.
 * `extra` carries any additional context from resolveCtx for richer descriptions.
 */
export interface DescCtx {
  entityTitle?: string;
  parentEntityTitle?: string;
  operation: string;
  extra: Record<string, string | undefined>;
}

export type DescFn = (ctx: DescCtx) => string;

export const descCreate =
  (type: string): DescFn =>
  ({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Create ${type} ${b(entityTitle)} in ${b(parentEntityTitle)}`
      : `Create ${type} ${b(entityTitle)}`;

export const descUpdate =
  (type: string): DescFn =>
  ({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Edit ${type} ${b(entityTitle)} in ${b(parentEntityTitle)}`
      : `Edit ${type} ${b(entityTitle)}`;

export const descDelete =
  (type: string): DescFn =>
  ({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Delete ${type} ${b(entityTitle)} from ${b(parentEntityTitle)}`
      : `Delete ${type} ${b(entityTitle)}`;

export const descAdd =
  (type: string): DescFn =>
  ({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Add ${b(entityTitle)} ${type} to ${b(parentEntityTitle)}`
      : `Add ${type} ${b(entityTitle)}`;

export const descRemove =
  (type: string): DescFn =>
  ({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Remove ${type} ${b(entityTitle)} from ${b(parentEntityTitle)}`
      : `Remove ${type} ${b(entityTitle)}`;

export const descRename =
  (type: string): DescFn =>
  ({ entityTitle, extra }) =>
    extra?.oldTitle
      ? `Rename ${type} ${b(extra.oldTitle)} to ${b(entityTitle)}`
      : `Rename ${type} to ${b(entityTitle)}`;

export const descShare =
  (type: string): DescFn =>
  ({ entityTitle }) =>
    `Share ${type} ${b(entityTitle)}`;
