export default class BookmarkGroup {
  constructor(_data: any) {
    Object.assign(this, _data);
  }

  public static async insert(..._args: any): Promise<any> {
    return null;
  }

  public static async list(..._args: any): Promise<any[]> {
    return [];
  }

  public static async get(..._args: any): Promise<any> {
    return null;
  }

  public static async update(..._args: any): Promise<any> {
    return null;
  }

  public static async delete(..._args: any): Promise<void> {}

  public static async getOrCreateUngrouped(..._args: any): Promise<any> {
    return null;
  }
}
