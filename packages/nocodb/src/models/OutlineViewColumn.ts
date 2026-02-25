export default class OutlineViewColumn {
  id: string;

  constructor(data: OutlineViewColumn) {
    Object.assign(this, data);
  }

  public static async get(..._args) {
    return null;
  }

  static async list(..._args) {
    return [];
  }

  static async insert(..._args) {
    return null;
  }

  static async update(..._args) {
    return null;
  }

  static async getNextOrderForLevel(..._args): Promise<number> {
    return 1;
  }
}
