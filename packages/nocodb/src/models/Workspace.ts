import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

export default class Workspace {
  id?: string;
  title?: string;
  fk_user_id?: string;
  status?: number;
  plan?: string;
  fk_org_id?: string;

  constructor(workspace: any) {
    Object.assign(this, workspace);
  }

  public static async getByTitle(..._args: any) {
    return undefined;
  }

  public static async get(
    workspaceId: string,
    _force?: boolean,
    ncMeta = Noco.ncMeta,
    _withStats?: boolean,
  ): Promise<Workspace | null> {
    const workspace = await ncMeta.metaGet2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      workspaceId,
    );
    return workspace ? new Workspace(workspace) : null;
  }

  public static async insert(..._args: any) {
    return null;
  }

  public static async update(..._args: any) {
    return null;
  }

  public static async updateStatusAndPlan(..._args: any) {
    return null;
  }

  public static async delete(..._args: any) {}

  public static async softDelete(..._args: any) {
    return false;
  }

  static async list(..._args: any) {
    return [];
  }

  static async count(..._args: any) {
    return 0;
  }

  static async listByOrgId(..._args: any) {
    return [];
  }

  static async updateOrgId(..._args: any) {
    return null;
  }

  public static async getFirstWorkspace(
    ncMeta = Noco.ncMeta,
  ): Promise<Workspace | null> {
    const workspace = await ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .orderBy('created_at', 'asc')
      .first();
    return workspace ? new Workspace(workspace) : null;
  }

  public static async getResourceStats(..._args: any) {
    return {};
  }

  public static async getStorageStats(..._args: any) {
    return null;
  }

  public static async clearWorkspaceStatsCache(..._args: any) {}
}
