import type { AppVersionRoutineType } from 'nocodb-sdk';

export default class AppVersionRoutine implements AppVersionRoutineType {
  id: string;
  fk_app_version_id: string;
  fk_routine_id: string;
  fk_routine_version_id: string;
  routine_name: string;

  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async getPin(..._args: any): Promise<AppVersionRoutine | null> {
    return null;
  }

  public static async listForAppVersion(
    ..._args: any
  ): Promise<AppVersionRoutine[]> {
    return [];
  }

  static async insert(..._args: any): Promise<AppVersionRoutine> {
    return null;
  }

  static async repin(..._args: any): Promise<number> {
    return 0;
  }
}
