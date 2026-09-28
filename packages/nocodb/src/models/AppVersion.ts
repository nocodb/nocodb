export default class AppVersion {
  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async get(..._args: any) {
    return null;
  }

  public static async insert(..._args: any): Promise<AppVersion> {
    return null;
  }

  public static async listByApp(..._args: any) {
    return [];
  }
}
