export default class DateDependency {
  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async get(..._args: any[]): Promise<any> {
    return null;
  }

  public static async getByModelId(..._args: any[]): Promise<any> {
    return null;
  }

  public static async insert(..._args: any[]): Promise<any> {
    return null;
  }

  public static async update(..._args: any[]): Promise<any> {
    return null;
  }

  public static async delete(..._args: any[]): Promise<void> {}

  public static async deleteByModelId(..._args: any[]): Promise<void> {}

  public static async isColumnUsed(..._args: any[]): Promise<boolean> {
    return false;
  }

  public static async clearColumnRef(..._args: any[]): Promise<void> {}
}
