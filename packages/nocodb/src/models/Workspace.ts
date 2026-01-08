export default class Workspace {
  constructor(workspace: any) {
    Object.assign(this, workspace);
  }

  public static async getByTitle(..._args: any) {
    return undefined;
  }

  public static async get(..._args: any) {
    return null;
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

  public static async getFirstWorkspace(..._args: any) {
    return null;
  }

  public static async getResourceStats(..._args: any) {
    return {};
  }

  public static async getStorageStats(..._args: any) {
    return null;
  }

  public static async clearWorkspaceStatsCache(..._args: any) {}
}
