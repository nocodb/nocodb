export default class BaseSection {
  constructor(data: BaseSection) {
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

  public static async findByTitle(..._args) {
    return null;
  }

  static async deleteByBaseId(..._args) {
    return true;
  }
}
