import type { BookmarkType } from 'nocodb-sdk';
import { CacheDelDirection, CacheGetType, CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export default class Bookmark implements BookmarkType {
  id?: string;
  fk_user_id?: string;
  fk_group_id?: string;
  title: string;
  target_type: 'workspace' | 'base' | 'table' | 'view' | 'document' | 'workflow' | 'script';
  target_id: string;
  order?: number;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<Bookmark>) {
    Object.assign(this, data);
  }

  protected static castType(bookmark: Bookmark): Bookmark {
    if (bookmark.meta && typeof bookmark.meta === 'string') {
      try {
        bookmark.meta = JSON.parse(bookmark.meta);
      } catch {
        bookmark.meta = {};
      }
    }
    return bookmark;
  }

  public static async insert(
    data: Partial<BookmarkType>,
    ncMeta = Noco.ncMeta,
  ): Promise<Bookmark> {
    const insertData = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARKS,
      {
        fk_user_id: data.fk_user_id,
        fk_group_id: data.fk_group_id,
        title: data.title,
        target_type: data.target_type,
        target_id: data.target_id,
        order: data.order ?? 0,
        meta: data.meta ? JSON.stringify(data.meta) : null,
      },
    );

    await NocoCache.set('root', `${CacheScope.BOOKMARK}:${insertData.id}`, insertData);

    await NocoCache.appendToList(
      'root',
      CacheScope.BOOKMARK,
      [data.fk_user_id],
      `${CacheScope.BOOKMARK}:${insertData.id}`,
    );

    return this.castType(new Bookmark(insertData));
  }

  public static async list(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Bookmark[]> {
    const { list: cachedList, isNoneList } = await NocoCache.getList(
      'root',
      CacheScope.BOOKMARK,
      [userId],
    );

    if (!isNoneList && cachedList.length) {
      return cachedList.map((item) => this.castType(new Bookmark(item)));
    }

    const list = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARKS,
      {
        condition: { fk_user_id: userId },
        orderBy: { order: 'asc' },
      },
    );

    for (const item of list) {
      await NocoCache.set('root', `${CacheScope.BOOKMARK}:${item.id}`, item);
    }
    await NocoCache.setList(
      'root',
      CacheScope.BOOKMARK,
      [userId],
      list,
    );

    return list.map((item) => this.castType(new Bookmark(item)));
  }

  public static async get(
    bookmarkId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Bookmark | null> {
    let data =
      bookmarkId &&
      (await NocoCache.get(
        'root',
        `${CacheScope.BOOKMARK}:${bookmarkId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!data) {
      data = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.BOOKMARKS,
        bookmarkId,
      );

      if (data) {
        await NocoCache.set('root', `${CacheScope.BOOKMARK}:${data.id}`, data);
      }
    }

    return data ? this.castType(new Bookmark(data)) : null;
  }

  public static async update(
    bookmarkId: string,
    data: Partial<BookmarkType>,
    ncMeta = Noco.ncMeta,
  ): Promise<Bookmark> {
    const updateObj: Record<string, any> = {};

    if (data.title !== undefined) updateObj.title = data.title;
    if (data.fk_group_id !== undefined) updateObj.fk_group_id = data.fk_group_id;
    if (data.order !== undefined) updateObj.order = data.order;
    if (data.meta !== undefined) updateObj.meta = JSON.stringify(data.meta);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARKS,
      updateObj,
      bookmarkId,
    );

    await NocoCache.update(
      'root',
      `${CacheScope.BOOKMARK}:${bookmarkId}`,
      updateObj,
    );

    return (await this.get(bookmarkId, ncMeta))!;
  }

  public static async delete(
    bookmarkId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARKS,
      bookmarkId,
    );

    await NocoCache.deepDel(
      'root',
      `${CacheScope.BOOKMARK}:${bookmarkId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  public static async listByGroup(
    groupId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Bookmark[]> {
    const list = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARKS,
      {
        condition: { fk_group_id: groupId },
        orderBy: { order: 'asc' },
      },
    );

    return list.map((item) => this.castType(new Bookmark(item)));
  }

  public static async moveToGroup(
    fromGroupId: string,
    toGroupId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BOOKMARKS,
      { fk_group_id: toGroupId },
      { fk_group_id: fromGroupId },
    );
  }
}
