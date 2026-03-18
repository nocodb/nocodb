import { nanoid } from 'nanoid';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

export interface IntegrationLinkType {
  id?: string;
  fk_integration_id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export default class IntegrationLink implements IntegrationLinkType {
  id?: string;
  fk_integration_id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;

  constructor(body: Partial<IntegrationLinkType>) {
    Object.assign(this, body);
  }

  // Use raw knex — base_id is a data column, not a scope column,
  // so metaInsert2/metaList2 would corrupt it with scope values.
  private static get knex() {
    return Noco.ncMeta.knex;
  }

  /**
   * Insert a new integration link (integration → base).
   */
  static async insert(
    _context: NcContext,
    body: Partial<IntegrationLinkType>,
    _ncMeta = Noco.ncMeta,
  ): Promise<IntegrationLink> {
    const id = `il_${nanoid(14)}`;

    const insertObj = {
      id,
      fk_integration_id: body.fk_integration_id,
      base_id: body.base_id,
      fk_workspace_id: body.fk_workspace_id,
      created_by: body.created_by,
    };

    await this.knex(MetaTable.INTEGRATION_LINKS).insert(insertObj);

    const link = new IntegrationLink(insertObj);

    // Set in cache
    const key = `${CacheScope.INTEGRATION_LINK}:${id}`;
    await NocoCache.set(_context, key, insertObj);
    await NocoCache.appendToList(
      _context,
      CacheScope.INTEGRATION_LINK,
      [insertObj.fk_integration_id],
      key,
    );
    await NocoCache.appendToList(
      _context,
      CacheScope.INTEGRATION_LINK,
      [insertObj.base_id],
      key,
    );

    return link;
  }

  /**
   * Get a single link by id.
   */
  static async get(
    context: NcContext,
    id: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<IntegrationLink | null> {
    let data = await NocoCache.get(
      context,
      `${CacheScope.INTEGRATION_LINK}:${id}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!data) {
      data = await this.knex(MetaTable.INTEGRATION_LINKS)
        .where('id', id)
        .first();

      if (data) {
        await NocoCache.set(
          context,
          `${CacheScope.INTEGRATION_LINK}:${data.id}`,
          data,
        );
      }
    }

    return data ? new IntegrationLink(data) : null;
  }

  /**
   * List all links for a given integration.
   */
  static async listByIntegration(
    context: NcContext,
    integrationId: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<IntegrationLink[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.INTEGRATION_LINK,
      [integrationId],
    );
    let { list: data } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !data.length) {
      data = await this.knex(MetaTable.INTEGRATION_LINKS)
        .where('fk_integration_id', integrationId);

      await NocoCache.setList(
        context,
        CacheScope.INTEGRATION_LINK,
        [integrationId],
        data,
      );
    }

    return data.map((d) => new IntegrationLink(d));
  }

  /**
   * List all links for a given base.
   */
  static async listByBase(
    context: NcContext,
    baseId: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<IntegrationLink[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.INTEGRATION_LINK,
      [baseId],
    );
    let { list: data } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !data.length) {
      data = await this.knex(MetaTable.INTEGRATION_LINKS)
        .where('base_id', baseId);

      await NocoCache.setList(
        context,
        CacheScope.INTEGRATION_LINK,
        [baseId],
        data,
      );
    }

    return data.map((d) => new IntegrationLink(d));
  }

  /**
   * Check if an integration is available to a base.
   *
   * Available if:
   *   - integration.is_restricted = false (unrestricted / legacy / workspace-created)
   *   - OR a link exists for (integration, base)
   *   - OR integration.is_global = true (checked by caller)
   */
  static async isAvailable(
    context: NcContext,
    param: {
      fk_integration_id: string;
      base_id: string;
      is_restricted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    // If caller already knows is_restricted, use it directly
    if (param.is_restricted === false) {
      return true;
    }

    // For restricted integrations, check explicit link
    const links = await this.listByIntegration(
      context,
      param.fk_integration_id,
      ncMeta,
    );

    return links.some((link) => link.base_id === param.base_id);
  }

  /**
   * Delete a specific link (integration + base pair).
   */
  static async deleteByIntegrationAndBase(
    context: NcContext,
    integrationId: string,
    baseId: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const link = await this.knex(MetaTable.INTEGRATION_LINKS)
      .where({
        fk_integration_id: integrationId,
        base_id: baseId,
      })
      .first();

    if (!link) return false;

    await this.knex(MetaTable.INTEGRATION_LINKS)
      .where('id', link.id)
      .del();

    await NocoCache.deepDel(
      context,
      `${CacheScope.INTEGRATION_LINK}:${link.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return true;
  }

  /**
   * Delete all links for a given integration.
   */
  static async deleteByIntegration(
    context: NcContext,
    integrationId: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const links = await this.listByIntegration(
      context,
      integrationId,
      _ncMeta,
    );

    for (const link of links) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.INTEGRATION_LINK}:${link.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    await this.knex(MetaTable.INTEGRATION_LINKS)
      .where('fk_integration_id', integrationId)
      .del();
  }

  /**
   * Delete all links for a given base.
   */
  static async deleteByBase(
    context: NcContext,
    baseId: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const links = await this.listByBase(context, baseId, _ncMeta);

    for (const link of links) {
      await NocoCache.deepDel(
        context,
        `${CacheScope.INTEGRATION_LINK}:${link.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    await this.knex(MetaTable.INTEGRATION_LINKS)
      .where('base_id', baseId)
      .del();
  }

  /**
   * Replace all links for an integration with a new set of base IDs.
   */
  static async replaceLinksForIntegration(
    context: NcContext,
    param: {
      integrationId: string;
      baseIds: string[];
      workspaceId: string;
      userId: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Delete existing links
    await this.deleteByIntegration(context, param.integrationId, ncMeta);

    // Insert new links
    for (const baseId of param.baseIds) {
      await this.insert(
        context,
        {
          fk_integration_id: param.integrationId,
          base_id: baseId,
          fk_workspace_id: param.workspaceId,
          created_by: param.userId,
        },
        ncMeta,
      );
    }
  }
}
