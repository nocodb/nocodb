export default class ListViewColumn {
  id: string;

  constructor(data: ListViewColumn) {
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
