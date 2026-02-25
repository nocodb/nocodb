import type { OutlineType } from 'nocodb-sdk';

export default class OutlineView implements OutlineType {
  fk_view_id: string;

  constructor(data: OutlineView) {
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
