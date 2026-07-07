import type { RoutineVersionType } from 'nocodb-sdk';

export default class AppRoutineVersion implements RoutineVersionType {
  id: string;
  fk_routine_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  version_number: number;
  source_type: RoutineVersionType['source_type'];
  source_ref: Record<string, unknown>;
  operation: string;
  template: RoutineVersionType['template'];
  param_schema: RoutineVersionType['param_schema'];
  body_hash: string;
  created_by?: string;
  created_at?: string;

  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async get(..._args: any): Promise<AppRoutineVersion | null> {
    return null;
  }

  public static async listForRoutine(..._args: any): Promise<AppRoutineVersion[]> {
    return [];
  }

  static async nextVersionNumber(..._args: any): Promise<number> {
    return 1;
  }

  static async insert(..._args: any): Promise<AppRoutineVersion> {
    return null;
  }
}
