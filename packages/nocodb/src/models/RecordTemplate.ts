// CE stub – Record Templates is an EE-only feature.
// The actual implementation lives in src/ee/models/RecordTemplate.ts
export default class RecordTemplate {
  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async insert(..._args: any) {
    return null;
  }

  public static async get(..._args: any) {
    return null;
  }

  public static async list(..._args: any) {
    return [];
  }

  public static async update(..._args: any) {
    return null;
  }

  public static async delete(..._args: any) {
    return true;
  }

  public static async incrementUsageCount(..._args: any) {
    return null;
  }

  public static castType(_template: any): RecordTemplate | null {
    return null;
  }
}
