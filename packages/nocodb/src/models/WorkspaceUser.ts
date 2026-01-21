export default class WorkspaceUser {
  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async insert(..._args: any[]) {}

  static async get(..._args: any[]) {
    return null;
  }

  static async workspaceList(..._args: any[]) {
    return [];
  }

  static async userList(..._args: any[]) {
    return [];
  }

  static async count(..._args: any[]) {
    return 0;
  }

  static async update(..._args: any[]) {
    return null;
  }

  static async softDelete(..._args: any[]) {
    return null;
  }

  private static async delete(..._args: any[]) {
    return null;
  }

  static async clearCache(..._args: any[]) {}

  static async getByToken(..._args: any[]) {
    return null;
  }
}
