import type { AppPageType } from 'nocodb-sdk';

export default class AppPage implements AppPageType {
  id: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_app_id: string;
  type: AppPageType['type'];
  route: string;
  title: string;
  slug: string;
  order?: number;
  meta?: AppPageType['meta'];
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;

  constructor(data: any) {
    Object.assign(this, data);
  }

  public static async get(..._args: any): Promise<AppPage | null> {
    return null;
  }

  public static async getBySlug(..._args: any): Promise<AppPage | null> {
    return null;
  }

  public static async getByRoute(..._args: any): Promise<AppPage | null> {
    return null;
  }

  public static async list(..._args: any): Promise<AppPage[]> {
    return [];
  }

  static async insert(..._args: any): Promise<AppPage> {
    return null;
  }

  static async update(..._args: any): Promise<AppPage> {
    return null;
  }

  static async softDelete(..._args: any): Promise<void> {}

  static async delete(..._args: any): Promise<void> {}

  routineNames(): string[] {
    return [];
  }
}
