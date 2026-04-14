import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';

export default class WorkspaceUser {
  fk_workspace_id?: string;
  fk_user_id?: string;
  roles?: string;
  invite_token?: string;
  deleted?: boolean;
  deleted_at?: string;

  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async insert(
    workspaceUser: Partial<WorkspaceUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(workspaceUser, [
      'fk_user_id',
      'fk_workspace_id',
      'roles',
      'invite_token',
    ]);

    return await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      insertObj,
      true,
    );
  }

  static async get(
    workspaceId: string,
    userId: string,
    _options: { include_deleted?: boolean } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<WorkspaceUser | null> {
    const wsUser = await ncMeta.metaGet2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      {
        fk_workspace_id: workspaceId,
        fk_user_id: userId,
      },
    );

    if (!wsUser || wsUser.deleted) return null;

    return new WorkspaceUser(wsUser);
  }

  static async userList(
    {
      fk_workspace_id,
    }: {
      fk_workspace_id: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<any[]> {
    const queryBuilder = ncMeta
      .knexConnection(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.USERS}.created_at`,
        `${MetaTable.USERS}.roles as main_roles`,
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
        `${MetaTable.WORKSPACE_USER}.roles`,
        `${MetaTable.WORKSPACE_USER}.invite_token`,
        `${MetaTable.WORKSPACE_USER}.deleted`,
      )
      .innerJoin(MetaTable.WORKSPACE_USER, function () {
        this.on(
          `${MetaTable.WORKSPACE_USER}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
          '=',
          ncMeta.knexConnection.raw('?', [fk_workspace_id]),
        );
      })
      .whereNot(`${MetaTable.WORKSPACE_USER}.deleted`, true);

    return await queryBuilder;
  }

  static async count(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const result = await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_workspace_id', workspaceId)
      .whereNot('deleted', true)
      .count('fk_user_id as count')
      .first();
    return (result as any)?.count || 0;
  }

  static async update(
    workspaceId: string,
    userId: string,
    data: Partial<WorkspaceUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(data, ['roles']);

    await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_workspace_id', workspaceId)
      .where('fk_user_id', userId)
      .update(updateObj);

    // Clear BASE_USER cache since workspace_roles is included in base user data
    await this.clearBaseUserCacheForWorkspace(workspaceId, ncMeta);
  }

  static async softDelete(
    workspaceId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_workspace_id', workspaceId)
      .where('fk_user_id', userId)
      .update({
        deleted: true,
        deleted_at: ncMeta.now(),
      });

    await this.clearBaseUserCacheForWorkspace(workspaceId, ncMeta);
  }

  static async softDeleteByUser(userId: string, ncMeta = Noco.ncMeta) {
    const entries = await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_user_id', userId)
      .whereNot('deleted', true)
      .select('fk_workspace_id');

    await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_user_id', userId)
      .update({
        deleted: true,
        deleted_at: ncMeta.now(),
      });

    for (const entry of entries) {
      await this.clearBaseUserCacheForWorkspace(entry.fk_workspace_id, ncMeta);
    }
  }

  static async clearBaseUserCacheForWorkspace(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const { default: Base } = await import('~/models/Base');
    const bases = await Base.list(null, ncMeta);
    for (const base of bases) {
      if (base.fk_workspace_id === workspaceId) {
        await NocoCache.deepDel(
          { workspace_id: workspaceId, base_id: base.id },
          `${CacheScope.BASE_USER}:${base.id}:list`,
          CacheDelDirection.PARENT_TO_CHILD,
        );
      }
    }
  }

  static async clearCache(..._args: any[]) {}

  static async getByToken(..._args: any[]) {
    return null;
  }

  static async workspaceList(..._args: any[]) {
    return [];
  }
}
