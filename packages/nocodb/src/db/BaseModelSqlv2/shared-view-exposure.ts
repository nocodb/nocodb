import { AsyncLocalStorage } from 'node:async_hooks';
import { isLinksOrLTAR, RelationTypes, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
} from '~/models';
import { View } from '~/models';
import { getViewExposedColumnIds } from '~/helpers/viewVisibleColumns';
import { isSharedViewAccess } from '~/helpers/accessSource';
import Noco from '~/Noco';

/**
 * Related column ids a shared view exposes through each link column, keyed by
 * the link column id. Built once from the columns the view exposes (shown and
 * layout columns, as the payload gate counts them), following lookup targets
 * transitively, then carried down the nested relation reads of that request so
 * each hop selects and returns only what the share needs. Rollups are left
 * out: they aggregate in SQL on the owner and never need the related values.
 */
export type SharedViewExposure = Map<string, Set<string>>;

const scope = new AsyncLocalStorage<SharedViewExposure>();

export const getSharedViewExposure = (): SharedViewExposure | undefined =>
  scope.getStore();

export const runWithSharedViewExposure = <T>(
  exposure: SharedViewExposure,
  fn: () => Promise<T>,
): Promise<T> => scope.run(exposure, fn);

export async function buildSharedViewExposure(
  context: NcContext,
  {
    model,
    viewId,
  }: {
    model: Model;
    viewId: string;
  },
): Promise<SharedViewExposure> {
  const exposure: SharedViewExposure = new Map();

  const view = await View.get(context, viewId);
  if (!view) return exposure;
  const exposedIds = await getViewExposedColumnIds(context, { model, view });

  const expose = (linkColumnId?: string, columnId?: string) => {
    if (!linkColumnId || !columnId) return;
    let ids = exposure.get(linkColumnId);
    if (!ids) exposure.set(linkColumnId, (ids = new Set()));
    ids.add(columnId);
  };

  const queue = (await model.getColumns()).filter((c) => exposedIds.has(c.id));
  const visited = new Set<string>();

  while (queue.length) {
    const column = queue.shift();
    if (!column || visited.has(column.id)) continue;
    visited.add(column.id);

    if (column.uidt === UITypes.Lookup) {
      const colOptions = await column.getColOptions<LookupColumn>();
      if (!colOptions || colOptions.error) continue;
      expose(colOptions.fk_relation_column_id, colOptions.fk_lookup_column_id);
      // A lookup target that is itself a lookup or link reads one hop further,
      // so its rows also need the key that hop resolves through.
      const target = await colOptions.getLookupColumn();
      if (target) {
        expose(
          colOptions.fk_relation_column_id,
          await relationDependencyColumnId(target),
        );
        queue.push(target);
      }
    } else if (isLinksOrLTAR(column)) {
      const colOptions =
        await column.getColOptions<LinkToAnotherRecordColumn>();
      expose(column.id, colOptions?.fk_display_value_column_id);
    }
  }

  return exposure;
}

/**
 * The column a nested read of `column`'s relation resolves through on its own
 * table, as `getAst`'s `extractRelationDependencies` adds it (e.g. the FK of a
 * belongs-to). `column` is a lookup (its relation) or a link.
 */
async function relationDependencyColumnId(
  column: Column,
): Promise<string | undefined> {
  const relationColumn =
    column.uidt === UITypes.Lookup
      ? await (await column.getColOptions<LookupColumn>())?.getRelationColumn()
      : isLinksOrLTAR(column)
      ? column
      : undefined;
  if (!relationColumn) return;

  const colOptions =
    await relationColumn.getColOptions<LinkToAnotherRecordColumn>();
  switch (colOptions?.type) {
    case RelationTypes.HAS_MANY:
      return colOptions.fk_parent_column_id;
    case RelationTypes.BELONGS_TO:
    case RelationTypes.MANY_TO_MANY:
      return colOptions.fk_child_column_id;
    case RelationTypes.ONE_TO_ONE:
      return relationColumn.meta?.bt
        ? colOptions.fk_child_column_id
        : colOptions.fk_parent_column_id;
  }
}

/**
 * The view's exposure, built once per request: memoised on the request-scoped
 * `context.cacheMap`, so batched reads outside a wrapped list don't rebuild it
 * per call. Never shared across requests.
 */
export function getRequestSharedViewExposure(
  context: NcContext,
  { model, viewId }: { model: Model; viewId: string },
): Promise<SharedViewExposure> {
  const cacheMap = (context.cacheMap ??= new Map());
  const key = `sharedViewExposure:${viewId}`;
  let exposure: Promise<SharedViewExposure> | undefined = cacheMap.get(key);
  if (!exposure) {
    exposure = buildSharedViewExposure(context, { model, viewId });
    cacheMap.set(key, exposure);
  }
  return exposure;
}

/**
 * Runs a shared view's own row read with its exposure, so the nested reads of
 * the rows' lookups select what they need. Licensed EE resolves them itself.
 */
export async function withSharedViewExposure<T>(
  context: NcContext,
  { model, viewId }: { model: Model; viewId: string },
  fn: () => Promise<T>,
): Promise<T> {
  if (Noco.isEE() || !isSharedViewAccess(context)) return fn();
  return runWithSharedViewExposure(
    await getRequestSharedViewExposure(context, { model, viewId }),
    fn,
  );
}
