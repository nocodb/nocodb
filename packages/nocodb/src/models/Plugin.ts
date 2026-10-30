import { Logger } from '@nestjs/common';
import type { PluginType } from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { decryptPropIfRequired } from '~/utils';
import { NcError } from '~/helpers/catchError';

const logger = new Logger('Plugin');

// Last undecryptable input per plugin id, so each bad value is logged once.
const loggedDecryptFailures = new Map<string, string>();

// Plain JSON is read as-is, anything else as ciphertext; returns JSON or null.
export const decryptPluginInput = (input: unknown) => {
  if (!input || typeof input !== 'string') return input as string | null;

  try {
    JSON.parse(input);
    return input;
  } catch {}

  try {
    return JSON.stringify(
      decryptPropIfRequired({ data: { input }, prop: 'input' }),
    );
  } catch {
    return null;
  }
};

const logDecryptFailure = (plugin: {
  id?: string;
  title?: string;
  input?: unknown;
}) => {
  const input = `${plugin.input}`;
  if (loggedDecryptFailures.get(plugin.id) === input) return;
  loggedDecryptFailures.set(plugin.id, input);
  logger.error(
    `Plugin config decryption failed: ${plugin.title} (${plugin.id})`,
  );
};

const withDecryptedInput = <
  T extends { id?: string; title?: string; input?: unknown },
>(
  plugin: T,
) => {
  if (!plugin) return plugin;
  const input = decryptPluginInput(plugin.input);
  if (plugin.input && !input) logDecryptFailure(plugin);
  return { ...plugin, input };
};

export default class Plugin implements PluginType {
  id?: string;
  title?: string;
  description?: string;
  active?: boolean;
  rating?: number;
  version?: string;
  docs?: string;
  status?: string;
  status_details?: string;
  logo?: string;
  icon?: string;
  tags?: string;
  category?: string;
  input_schema?: string;
  input?: string | null;
  creator?: string;
  creator_website?: string;
  price?: string;

  constructor(audit: Partial<PluginType>) {
    Object.assign(this, audit);
  }

  public static async get(pluginId: string, ncMeta = Noco.ncMeta) {
    let plugin =
      pluginId &&
      (await NocoCache.get(
        'root',
        `${CacheScope.PLUGIN}:${pluginId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!plugin) {
      plugin = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.PLUGIN,
        pluginId,
      );
      await NocoCache.set('root', `${CacheScope.PLUGIN}:${pluginId}`, plugin);
    }
    return plugin && new Plugin(withDecryptedInput(plugin));
  }

  static async list(ncMeta = Noco.ncMeta) {
    const cachedList = await NocoCache.getList('root', CacheScope.PLUGIN, []);
    let { list: pluginList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !pluginList.length) {
      pluginList = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.PLUGIN,
      );
      await NocoCache.setList('root', CacheScope.PLUGIN, [], pluginList);
    }
    return pluginList.map(withDecryptedInput);
  }

  static async count(ncMeta = Noco.ncMeta): Promise<number> {
    return (await ncMeta.knex(MetaTable.PLUGIN).count('id', { as: 'count' }))
      ?.count;
  }

  public static async update(pluginId: string, plugin: Partial<PluginType>) {
    const updateObj = extractProps(plugin, ['input', 'active']);

    if (updateObj.input && typeof updateObj.input === 'object') {
      updateObj.input = JSON.stringify(updateObj.input);
    }

    // set meta
    await Noco.ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLUGIN,
      updateObj,
      pluginId,
    );

    await NocoCache.update(
      'root',
      `${CacheScope.PLUGIN}:${pluginId}`,
      updateObj,
    );

    return this.get(pluginId);
  }

  // Throws rather than handing an adapter a null config.
  public static parseInput(plugin: {
    id?: string;
    title?: string;
    input?: unknown;
  }): Record<string, any> | null {
    if (!plugin?.input) return null;

    const input = decryptPluginInput(plugin.input);
    if (!input) {
      logDecryptFailure(plugin);
      NcError.internalServerError(
        `Plugin config decryption failed: ${plugin.title}`,
      );
    }
    return JSON.parse(input);
  }

  public static async isPluginActive(id: string, ncMeta = Noco.ncMeta) {
    return !!(
      (await this.getPlugin(id, ncMeta)) ||
      (await this.getPluginByTitle(id, ncMeta))
    )?.active;
  }

  /**
   * get plugin by id
   */
  public static async getPlugin(id: string, ncMeta = Noco.ncMeta) {
    let plugin =
      id &&
      (await NocoCache.get(
        'root',
        `${CacheScope.PLUGIN}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!plugin) {
      plugin = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.PLUGIN,
        id,
      );
      await NocoCache.set('root', `${CacheScope.PLUGIN}:${id}`, plugin);
    }
    return withDecryptedInput(plugin);
  }

  // keeping it for backward compatibility, if someone configured google auth via plugin it still relies on this
  static async getPluginByTitle(title: string, ncMeta = Noco.ncMeta) {
    const plugin = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLUGIN,
      { title },
    );
    return withDecryptedInput(plugin);
  }
}
