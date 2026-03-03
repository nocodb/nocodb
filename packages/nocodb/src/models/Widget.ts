export default class Widget {
  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async get(..._args: any) {
    return null;
  }

  public static async list(..._args: any) {
    return [];
  }

  static async insert(..._args: any): Promise<Widget> {
    return null;
  }

  static async update(..._args: any): Promise<Widget> {
    return null;
  }

  static async delete(..._args: any): Promise<void> {
    return null;
  }
}
