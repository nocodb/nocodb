import type { RoutineType } from 'nocodb-sdk';

export default class AppRoutine implements RoutineType {
  id: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_app_id: string;
  title: string;
  name: string;
  description?: string;
  fk_current_version_id?: string;
  created_by?: string;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;

  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async get(..._args: any): Promise<AppRoutine | null> {
    return null;
  }

  public static async getByName(..._args: any): Promise<AppRoutine | null> {
    return null;
  }

  public static async list(..._args: any): Promise<AppRoutine[]> {
    return [];
  }

  static async insert(..._args: any): Promise<AppRoutine> {
    return null;
  }

  static async update(..._args: any): Promise<AppRoutine> {
    return null;
  }

  static async softDelete(..._args: any): Promise<void> {}
}
