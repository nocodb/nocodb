export default class Dashboard {
  constructor(data: Dashboard) {
    Object.assign(this, data);
  }

  public static async get(..._args) {
    return null;
  }

  public static async list(..._args) {
    return [];
  }

  static async insert(..._args) {
    return null;
  }

  static async update(..._args) {
    return null;
  }

  static async delete(..._args) {
    return null;
  }

  async getWidgets(..._args) {
    return [];
  }
}
