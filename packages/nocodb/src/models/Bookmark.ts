export default class Bookmark {
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

  public static async maxOrder(..._args: any): Promise<number> {
    return 0;
  }

  public static async listByGroup(..._args: any): Promise<any[]> {
    return [];
  }

  public static async moveToGroup(..._args: any): Promise<void> {}
}
