export default class Workflow {
  constructor(_workflow: any) {
    Object.assign(this, _workflow);
  }

  public static async get(..._args: any) {
    return null;
  }

  public static async list(..._args: any) {
    return [];
  }

  public static async insert(..._args: any) {
    return null;
  }

  public static async update(..._args: any) {
    return null;
  }

  static async delete(..._args: any) {
    return null;
  }

  public static async findByTrigger(..._args: any) {
    return [];
  }
}
