import type { ListViewLevelType } from 'nocodb-sdk';

export default class ListViewLevel implements ListViewLevelType {
  id: string;

  constructor(data: ListViewLevel) {
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

  static async delete(..._args) {
    return null;
  }

  static async bulkInsertOrUpdate(..._args) {
    return [];
  }
}
