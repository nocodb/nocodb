import type { BookmarkGroupType } from 'nocodb-sdk';
import { CacheDelDirection, CacheGetType, CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export default class BookmarkGroup implements BookmarkGroupType {
  id?: string;
  fk_user_id?: string;
  name: string;
  order?: number;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<BookmarkGroup>) {
    Object.assign(this, data);
  }

  public static async insert(
    data: Partial<BookmarkGroupType>,
    ncMeta = Noco.ncMeta,
  ): Promise<BookmarkGroup> {
    const insertData = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARK_GROUPS,
      {
        fk_user_id: data.fk_user_id,
        name: data.name,
        order: data.order ?? 0,
      },
    );

    await NocoCache.appendToList(
      'root',
      CacheScope.BOOKMARK_GROUP,
      [data.fk_user_id],
      `${CacheScope.BOOKMARK_GROUP}:${insertData.id}`,
    );

    return new BookmarkGroup(insertData);
  }

  public static async list(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BookmarkGroup[]> {
    const { list: cachedList, isNoneList } = await NocoCache.getList(
      'root',
      CacheScope.BOOKMARK_GROUP,
      [userId],
    );

    if (!isNoneList && cachedList.length) {
      return cachedList.map((item) => new BookmarkGroup(item));
    }

    const list = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARK_GROUPS,
      {
        condition: { fk_user_id: userId },
        orderBy: { order: 'asc' },
      },
    );

    for (const item of list) {
      await NocoCache.set('root', `${CacheScope.BOOKMARK_GROUP}:${item.id}`, item);
    }
    await NocoCache.setList(
      'root',
      CacheScope.BOOKMARK_GROUP,
      [userId],
      list,
    );

    return list.map((item) => new BookmarkGroup(item));
  }

  public static async get(
    groupId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BookmarkGroup | null> {
    let data =
      groupId &&
      (await NocoCache.get(
        'root',
        `${CacheScope.BOOKMARK_GROUP}:${groupId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!data) {
      data = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.BOOKMARK_GROUPS,
        groupId,
      );

      if (data) {
        await NocoCache.set(
          'root',
          `${CacheScope.BOOKMARK_GROUP}:${data.id}`,
          data,
        );
      }
    }

    return data ? new BookmarkGroup(data) : null;
  }

  public static async update(
    groupId: string,
    data: Partial<BookmarkGroupType>,
    ncMeta = Noco.ncMeta,
  ): Promise<BookmarkGroup> {
    const updateObj: Partial<BookmarkGroupType> = {};

    if (data.name !== undefined) updateObj.name = data.name;
    if (data.order !== undefined) updateObj.order = data.order;

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARK_GROUPS,
      updateObj,
      groupId,
    );

    await NocoCache.update(
      'root',
      `${CacheScope.BOOKMARK_GROUP}:${groupId}`,
      updateObj,
    );

    return (await this.get(groupId, ncMeta))!;
  }

  public static async delete(
    groupId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const group = await this.get(groupId, ncMeta);
    if (!group) return;

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARK_GROUPS,
      groupId,
    );

    await NocoCache.deepDel(
      'root',
      `${CacheScope.BOOKMARK_GROUP}:${groupId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  public static async getOrCreateUngrouped(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<BookmarkGroup> {
    const groups = await this.list(userId, ncMeta);
    const ungrouped = groups.find((g) => g.name === 'Ungrouped');

    if (ungrouped) return ungrouped;

    return this.insert(
      { fk_user_id: userId, name: 'Ungrouped', order: 0 },
      ncMeta,
    );
  }
}
