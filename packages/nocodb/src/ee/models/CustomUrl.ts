import CustomUrlCE from 'src/models/CustomUrl';
import { NcError } from 'src/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { getFeature, PlanFeatureTypes } from '~/helpers/paymentHelpers';

export default class CustomUrl extends CustomUrlCE {
  public static async get(
    params: Partial<Pick<CustomUrl, 'id' | 'view_id' | 'custom_path'>>,
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, [
      'id',
      'view_id',
      'custom_path',
      'fk_dashboard_id',
    ]);

    const customUrl = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.CUSTOM_URLS,
      condition,
    );

    return customUrl && new CustomUrl(customUrl);
  }

  public static async getCustomUrlByCustomPath(
    customPath: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CustomUrl | undefined> {
    let customUrl;

    customUrl = await NocoCache.get(
      `${CacheScope.CUSTOM_URLS}:${customPath}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!customUrl) {
      customUrl = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.CUSTOM_URLS,
        {
          custom_path: customPath,
        },
      );

      if (customUrl) {
        NocoCache.set(`${CacheScope.CUSTOM_URLS}:${customPath}`, customUrl);
      }
    }

    if (!customUrl) {
      return;
    }

    const isCustomUrlEnabled = await getFeature(
      PlanFeatureTypes.FEATURE_CUSTOM_URL,
      customUrl.fk_workspace_id,
    );

    if (!isCustomUrlEnabled) return;

    return customUrl;
  }

  public static async insert(
    customUrl: Partial<CustomUrl>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertData = extractProps(customUrl, [
      'fk_workspace_id',
      'base_id',
      'fk_model_id',
      'view_id',
      'original_path',
      'custom_path',
      'fk_dashboard_id',
    ]);

    if (insertData.custom_path?.length > 128) {
      NcError.badRequest('CustomUrl path must be at most 128 characters long');
    }

    const existingCustomUrl = await CustomUrl.getCustomUrlByCustomPath(
      insertData.custom_path,
      ncMeta,
    );

    if (existingCustomUrl) {
      NcError.badRequest('CustomUrl path already taken');
    }

    const insertedCustomUrl = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.CUSTOM_URLS,
      insertData,
    );

    await NocoCache.set(
      `${CacheScope.CUSTOM_URLS}:${insertedCustomUrl.custom_path}`,
      insertedCustomUrl,
    );

    return insertedCustomUrl && new CustomUrl(insertedCustomUrl);
  }

  public static async list(
    params: Partial<
      Pick<
        CustomUrl,
        'fk_workspace_id' | 'base_id' | 'fk_model_id' | 'fk_dashboard_id'
      >
    >,
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, [
      'fk_workspace_id',
      'base_id',
      'fk_model_id',
      'fk_dashboard_id',
    ]);

    const customUrlList = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.CUSTOM_URLS,
      {
        condition,
      },
    );

    return customUrlList.map((customUrl) => new CustomUrl(customUrl));
  }

  public static async update(
    id: string,
    customUrl: Partial<CustomUrl>,
    ncMeta = Noco.ncMeta,
  ) {
    const customUrlData = await CustomUrl.get({ id });

    if (!customUrlData) {
      NcError.notFound();
    }

    const updateData = extractProps(customUrl, [
      'original_path',
      'custom_path',
    ]);

    if (updateData.custom_path?.length > 128) {
      NcError.badRequest('CustomUrl path must be at most 128 characters long');
    }

    const existingCustomUrl = await CustomUrl.getCustomUrlByCustomPath(
      updateData.custom_path,
      ncMeta,
    );

    if (existingCustomUrl) {
      NcError.badRequest('CustomUrl path already taken');
    }

    await NocoCache.del(
      `${CacheScope.CUSTOM_URLS}:${customUrlData.custom_path}`,
    );

    return await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.CUSTOM_URLS,
      updateData,
      id,
    );
  }

  public static async checkAvailability(
    params: Partial<Pick<CustomUrl, 'id' | 'custom_path'>>,
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, ['custom_path']);

    const customUrlList = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.CUSTOM_URLS,
      {
        condition,
        xcCondition: params.id
          ? {
              _and: [
                {
                  id: {
                    neq: params.id,
                  },
                },
              ],
            }
          : null,
      },
    );

    return !customUrlList.length;
  }

  static async delete(
    customUrl: Partial<Pick<CustomUrl, 'id' | 'view_id' | 'fk_dashboard_id'>>,
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(customUrl, [
      'id',
      'view_id',
      'fk_dashboard_id',
    ]);

    const customUrlData = await CustomUrl.get(condition, ncMeta);

    if (!customUrlData) {
      return;
    }

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.CUSTOM_URLS,
      condition,
    );

    await NocoCache.del(
      `${CacheScope.CUSTOM_URLS}:${customUrlData.custom_path}`,
    );
  }

  static async bulkDelete(
    params: Partial<
      Pick<
        CustomUrl,
        'fk_workspace_id' | 'base_id' | 'fk_model_id' | 'fk_dashboard_id'
      >
    >,
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, [
      'fk_workspace_id',
      'base_id',
      'fk_model_id',
      'fk_dashboard_id',
    ]);

    if (
      !condition.fk_workspace_id &&
      !condition.base_id &&
      !condition.fk_model_id &&
      !condition.fk_dashboard_id
    ) {
      NcError.badRequest(
        'At least one of fk_workspace_id, base_id or fk_model_id is required',
      );
    }

    const customUrlList = await this.list(condition, ncMeta);

    if (!customUrlList.length) {
      return;
    }

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.CUSTOM_URLS,
      condition,
    );

    await NocoCache.del(
      customUrlList.map((c) => `${CacheScope.CUSTOM_URLS}:${c.custom_path}`),
    );
  }
}
