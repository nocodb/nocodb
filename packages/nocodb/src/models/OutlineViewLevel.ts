import type { OutlineViewLevelType } from 'nocodb-sdk';

export default class OutlineViewLevel implements OutlineViewLevelType {
  id: string;

  constructor(data: OutlineViewLevel) {
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
