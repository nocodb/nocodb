import {
  buildDefaultRecordDetailConfig,
  InterfacePageLayoutTypes,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { ColumnType } from 'nocodb-sdk';
import { MetaTable } from '~/utils/globals';

type PageRow = {
  id: string;
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

/** Does any node under a page config bind `detailPageId` as a detail sheet? */
const bindsDetailPage = (node: unknown, detailPageId: string): boolean => {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    return node.some((child) => bindsDetailPage(child, detailPageId));
  }
  const obj = node as Record<string, unknown>;
  if (obj.fk_detail_page_id === detailPageId) return true;
  for (const value of Object.values(obj)) {
    if (
      value &&
      typeof value === 'object' &&
      bindsDetailPage(value, detailPageId)
    ) {
      return true;
    }
  }
  return false;
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
    'fk_interface_id',
    'fk_model_id',
    'layout',
    'config',
    'published_config',
  );
  if (!pages.length) return;

  const byInterface = new Map<string, PageRow[]>();
  for (const page of pages) {
    const list = byInterface.get(page.fk_interface_id) ?? [];
    list.push(page);
    byInterface.set(page.fk_interface_id, list);
  }

  const columnsByModel = new Map<string, ColumnType[]>();

  for (const page of pages) {
    if (page.layout !== InterfacePageLayoutTypes.RECORD_DETAIL) continue;
    if (!page.fk_model_id) continue;

    const draft = parseConfig(page.config);
    const published = parseConfig(page.published_config);
    const healDraft = groupsEmpty(draft);
    // A null published_config means never published — leave it null.
    const healPublished =
      page.published_config != null && groupsEmpty(published);
    if (!healDraft && !healPublished) continue;

    const siblings = byInterface.get(page.fk_interface_id) ?? [];
    const bound = siblings.some(
      (sibling) =>
        sibling.id !== page.id &&
        (bindsDetailPage(parseConfig(sibling.config), page.id) ||
          bindsDetailPage(parseConfig(sibling.published_config), page.id)),
    );
    if (!bound) continue;

    let columns = columnsByModel.get(page.fk_model_id);
    if (!columns) {
      columns = (await knex(MetaTable.COLUMNS)
        .where('fk_model_id', page.fk_model_id)
        .select(
          'id',
          'uidt',
          'pk',
          'ai',
          'cdf',
          'system',
          'meta',
        )) as ColumnType[];
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
    }
  }
};

const down = async () => {
  // Data heal — the seeded groups are valid layouts; nothing to revert.
};

export { up, down };
