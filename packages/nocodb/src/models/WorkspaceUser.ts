import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';

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
    workspaceId: string,
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
          ncMeta.knexConnection.raw('?', [workspaceId]),
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

    return await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_workspace_id', workspaceId)
      .where('fk_user_id', userId)
      .update(updateObj);
  }

  static async softDelete(
    workspaceId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_workspace_id', workspaceId)
      .where('fk_user_id', userId)
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
      });
  }

  static async clearCache(..._args: any[]) {}

  static async getByToken(..._args: any[]) {
    return null;
  }

  static async workspaceList(..._args: any[]) {
    return [];
  }
}
