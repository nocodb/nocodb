import type { CustomUrlType } from 'nocodb-sdk';
import Noco from '~/Noco';

export default class CustomUrl implements CustomUrlType {
  public id?: string;
  public fk_workspace_id?: string;
  public base_id?: string;
  public fk_model_id?: string;
  public view_id?: string;
  public original_path?: string;
  public custom_path?: string;

  constructor(customUrl: Partial<CustomUrl>) {
    Object.assign(this, customUrl);
  }

  public static async get(
    _params: Partial<Pick<CustomUrl, 'id' | 'view_id' | 'custom_path'>>,
    _ncMeta = Noco.ncMeta,
  ) {
    return {} as CustomUrl;
  }

  public static async getCustomUrlByCustomPath(
    _customPath: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<CustomUrl | undefined> {
    return;
  }

  public static async insert(
    _customUrl: Partial<CustomUrl>,
    _ncMeta = Noco.ncMeta,
  ) {
    return {} as CustomUrl;
  }

  public static async list(
    _params: Partial<
      Pick<CustomUrl, 'fk_workspace_id' | 'base_id' | 'fk_model_id'>
    >,
    _ncMeta = Noco.ncMeta,
  ) {
    return [] as CustomUrl[];
  }

  public static async update(
    _id: string,
    _customUrl: Partial<CustomUrl>,
    _ncMeta = Noco.ncMeta,
  ) {
    return {} as CustomUrl;
  }

  public static async checkAvailability(
    _params: Partial<Pick<CustomUrl, 'id' | 'custom_path'>>,
    _ncMeta = Noco.ncMeta,
  ) {
    return false;
  }

  static async delete(
    _customUrl: Partial<Pick<CustomUrl, 'id' | 'view_id'>>,
    _ncMeta = Noco.ncMeta,
  ): Promise<any> {}

  static async bulkDelete(
    _params: Partial<
      Pick<CustomUrl, 'fk_workspace_id' | 'base_id' | 'fk_model_id'>
    >,
    _ncMeta = Noco.ncMeta,
  ): Promise<any> {}
}
