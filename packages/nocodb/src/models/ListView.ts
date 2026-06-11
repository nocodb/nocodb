import type { ListType } from 'nocodb-sdk';

export default class ListView implements ListType {
  fk_view_id: string;

  constructor(data: ListView) {
    Object.assign(this, data);
  }

  public static async get(..._args) {
    return null;
  }

  static async insert(..._args) {
    return null;
  }

  static async update(..._args) {
    return null;
  }
}
