import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';

/**
 * CE has no managed apps, so it has no second author to keep apart and nothing
 * to namespace. The EE overlay (`src/ee/helpers/customObjects.ts`) carries the
 * real rules; these shapes exist so shared code can call them unconditionally.
 */
export const CUSTOM_OBJECT_SUFFIX = '__c';

export type CustomObjectKind =
  | 'table'
  | 'field'
  | 'view'
  | 'dashboard'
  | 'automation'
  | 'agent'
  | 'webhook';

export type NamespaceBase = {
  managed_app_id?: string;
  managed_app_master?: boolean;
  is_lane_instance?: boolean;
};

export type ClaimOpts = {
  base?: NamespaceBase;
  baseId?: string;
  insideTable?: string | null;
  ncMeta?: MetaService;
};

export function isCustomObjectName(_name?: string | null): boolean {
  return false;
}

export function toCustomObjectName(name: string): string {
  return name;
}

export async function claimObjectName<T extends string | null | undefined>(
  _context: NcContext,
  _kind: CustomObjectKind,
  name: T,
  _opts?: ClaimOpts,
): Promise<T> {
  return name;
}

export async function claimObjectTitle<T extends string | null | undefined>(
  _context: NcContext,
  _kind: CustomObjectKind,
  title: T,
  _opts?: ClaimOpts,
): Promise<T> {
  return title;
}

export async function marksCustomObjects(
  _context: NcContext,
  _opts?: ClaimOpts,
): Promise<boolean> {
  return false;
}

export async function keepObjectName<T extends string | null | undefined>(
  _context: NcContext,
  _currentName: string | null | undefined,
  name: T,
  _opts?: ClaimOpts,
): Promise<T> {
  return name;
}
