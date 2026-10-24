import { InterfacePageLayoutTypes, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

type PageRow = {
  id: string;
  base_id: string;
  fk_workspace_id: string;
  fk_interface_id: string;
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

/** The record-detail config a page carries — its own, or a record review's right pane. */
const detailOf = (layout: string, config: Record<string, any> | null) =>
  layout === InterfacePageLayoutTypes.RECORD_REVIEW ? config?.detail : config;

const fieldElementsOf = (detail: Record<string, any> | undefined) => {
  const out: Record<string, any>[] = [];
  for (const group of detail?.groups ?? []) {
    for (const row of group?.rows ?? []) out.push(...(row?.fields ?? []));
    out.push(...(group?.fields ?? []));
  }
  return out.filter((f) => f && typeof f === 'object');
};

/** Inline layouts' link elements with Link/unlink unset — those the new default would turn on. */
const unsetInlineLinkElements = (
  detail: Record<string, any> | undefined,
  linkColumnIds?: Set<string>,
) => {
  if (detail?.user_actions?.edit_fields !== 'inline') return [];
  return fieldElementsOf(detail).filter(
    (f) =>
      typeof f.fk_column_id === 'string' &&
      f.allow_link_unlink === undefined &&
      (!linkColumnIds || linkColumnIds.has(f.fk_column_id)),
  );
};

/**
 * Link/unlink on a record-layout link field now defaults ON under Inline edit
 * (it was off unless set). Stamp an explicit `false` on existing Inline
 * layouts so no live page gains link/unlink without the builder choosing it.
 */
const up = async (knex: Knex) => {
  const pages: PageRow[] = await knex(MetaTable.INTERFACE_PAGES)
    .whereIn('layout', [
      InterfacePageLayoutTypes.RECORD_DETAIL,
      InterfacePageLayoutTypes.RECORD_REVIEW,
    ])
    .select(
      'id',
      'base_id',
      'fk_workspace_id',
      'fk_interface_id',
      'layout',
      'config',
      'published_config',
    );
  if (!pages.length) return;

  const parsed = pages.map((page) => ({
    page,
    draft: parseConfig(page.config),
    published: parseConfig(page.published_config),
  }));

  const candidateColumnIds = new Set<string>();
  for (const { page, draft, published } of parsed) {
    for (const config of [draft, published]) {
      for (const f of unsetInlineLinkElements(detailOf(page.layout, config))) {
        candidateColumnIds.add(f.fk_column_id);
      }
    }
  }
  if (!candidateColumnIds.size) return;

  const linkColumnIds = new Set<string>();
  const ids = [...candidateColumnIds];
  for (let i = 0; i < ids.length; i += 500) {
    const rows: { id: string }[] = await knex(MetaTable.COLUMNS)
      .whereIn('id', ids.slice(i, i + 500))
      .whereIn('uidt', [UITypes.Links, UITypes.LinkToAnotherRecord])
      .select('id');
    for (const row of rows) linkColumnIds.add(row.id);
  }
  if (!linkColumnIds.size) return;

  for (const { page, draft, published } of parsed) {
    const update: Record<string, string> = {};

    for (const [key, config] of [
      ['config', draft],
      ['published_config', published],
    ] as const) {
      const elements = unsetInlineLinkElements(
        detailOf(page.layout, config),
        linkColumnIds,
      );
      if (!elements.length) continue;
      for (const f of elements) f.allow_link_unlink = false;
      update[key] = JSON.stringify(config);
    }

    if (!Object.keys(update).length) continue;

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
};

const down = async () => {
  // Explicit `false` reads the same as the old unset default; nothing to revert.
};

export { up, down };
