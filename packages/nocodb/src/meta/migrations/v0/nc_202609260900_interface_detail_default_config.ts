import {
  buildDefaultRecordDetailConfig,
  InterfacePageLayoutTypes,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { ColumnType } from 'nocodb-sdk';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

type PageRow = {
  id: string;
  base_id: string;
  fk_workspace_id: string;
  fk_interface_id: string;
  fk_model_id: string | null;
  layout: string;
  config: string | null;
  published_config: string | null;
};

const parseConfig = (raw: string | null): Record<string, any> | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return null;
  }
};

/** A layout with no field element anywhere — the never-designed shape. */
const groupsEmpty = (config: Record<string, any> | null): boolean => {
  const groups = config?.groups;
  if (!Array.isArray(groups) || !groups.length) return true;
  return !groups.some((group) => {
    const rows = Array.isArray(group?.rows) ? group.rows : [];
    if (rows.some((row) => Array.isArray(row?.fields) && row.fields.length)) {
      return true;
    }
    return Array.isArray(group?.fields) && group.fields.length;
  });
};

/** Collect every `fk_detail_page_id` under a page config. */
const collectBoundIds = (node: unknown, out: Set<string>) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectBoundIds(child, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.fk_detail_page_id === 'string') out.add(obj.fk_detail_page_id);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') collectBoundIds(value, out);
  }
};

/**
 * A RECORD_DETAIL page created by the click-into-details toggle stores an empty
 * layout (`{ groups: [] }`), which publishes as a CLOSED allow-list — a consumer
 * opening the linked sheet reads back the display value only. Materialize the
 * default groups (the same set the builder canvas renders) into `config` /
 * `published_config` so consumers and builders see the same fields.
 *
 * Only pages some sibling binds as a click-into-details target are healed;
 * unbound empty pages were never designed and never reached, so they stay closed
 * (the F2 boundary is unchanged for them).
 */
const up = async (knex: Knex) => {
  const pages: PageRow[] = await knex(MetaTable.INTERFACE_PAGES).select(
    'id',
    'base_id',
    'fk_workspace_id',
    'fk_interface_id',
    'fk_model_id',
    'layout',
    'config',
    'published_config',
  );
  if (!pages.length) return;

  // Parse once; binders map each bound detail page id to the pages binding it.
  const parsed = new Map<
    string,
    { draft: Record<string, any> | null; published: Record<string, any> | null }
  >();
  const bindersOf = new Map<string, Set<string>>();
  const interfaceOf = new Map(pages.map((p) => [p.id, p.fk_interface_id]));
  for (const page of pages) {
    const draft = parseConfig(page.config);
    const published = parseConfig(page.published_config);
    parsed.set(page.id, { draft, published });
    const bound = new Set<string>();
    collectBoundIds(draft, bound);
    collectBoundIds(published, bound);
    for (const id of bound) {
      const set = bindersOf.get(id) ?? new Set<string>();
      set.add(page.id);
      bindersOf.set(id, set);
    }
  }

  const columnsByModel = new Map<string, ColumnType[]>();

  for (const page of pages) {
    if (page.layout !== InterfacePageLayoutTypes.RECORD_DETAIL) continue;
    if (!page.fk_model_id) continue;

    const { draft, published } = parsed.get(page.id)!;
    const healDraft = groupsEmpty(draft);
    // A null published_config means never published — leave it null. A
    // designed draft means the builder chose fields but hasn't published:
    // leave the snapshot closed rather than publish every column.
    const healPublished =
      page.published_config != null && groupsEmpty(published) && healDraft;
    if (!healDraft && !healPublished) continue;

    const binders = bindersOf.get(page.id);
    const bound = [...(binders ?? [])].some(
      (id) => id !== page.id && interfaceOf.get(id) === page.fk_interface_id,
    );
    if (!bound) continue;

    let columns = columnsByModel.get(page.fk_model_id);
    if (!columns) {
      columns = (await knex(MetaTable.COLUMNS)
        .where('fk_model_id', page.fk_model_id)
        .select('id', 'uidt', 'pk', 'ai', 'cdf', 'system', 'meta')
        .orderBy('order', 'asc')) as ColumnType[];
      columnsByModel.set(page.fk_model_id, columns);
    }

    // Fresh ids per page so two detail pages of one table never share element ids.
    const defaultGroups = buildDefaultRecordDetailConfig(columns).groups;
    if (!defaultGroups[0]?.rows?.length) continue;

    const update: Record<string, string> = {};
    if (healDraft) {
      update.config = JSON.stringify({
        ...(draft ?? {}),
        groups: defaultGroups,
      });
    }
    if (healPublished) {
      update.published_config = JSON.stringify({
        ...(published ?? {}),
        groups: defaultGroups,
      });
    }
    if (Object.keys(update).length) {
      await knex(MetaTable.INTERFACE_PAGES).where('id', page.id).update(update);
      // Knex migrations don't flush the cache, and cloud never flushes on boot.
      await NocoCache.del(
        { workspace_id: page.fk_workspace_id, base_id: page.base_id },
        [
          `${CacheScope.INTERFACE_PAGE}:${page.id}`,
          `${CacheScope.INTERFACE_PAGE}:${page.fk_interface_id}:list`,
        ],
      );
    }
  }
};

const down = async () => {
  // Data heal — the seeded groups are valid layouts; nothing to revert.
};

export { up, down };
