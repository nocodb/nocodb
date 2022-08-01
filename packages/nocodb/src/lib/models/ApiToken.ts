import { MetaTable } from '../utils/globals';
import Noco from '../Noco';
import { nanoid } from 'nanoid';

export default class ApiToken {
  project_id?: string;
  db_alias?: string;
  description?: string;
  permissions?: string;
  token?: string;
  expiry?: string;
  enabled?: boolean;
  user_id?: string;

  constructor(audit: Partial<ApiToken>) {
    Object.assign(this, audit);
  }

  public static async insert(
    apiToken: Partial<ApiToken>,
    ncMeta = Noco.ncMeta
  ) {
    const token = nanoid(40);
    await ncMeta.metaInsert(null, null, MetaTable.API_TOKENS, {
      description: apiToken.description,
      user_id: apiToken?.user_id,
      token
    });
    return this.getByToken(token, apiToken?.user_id);
  }

  static async list(userId = null, ncMeta = Noco.ncMeta) {
    const tokens = await ncMeta.metaList(null, null, MetaTable.API_TOKENS, {
      condition: { user_id: userId },
    });
    return tokens?.map(t => new ApiToken(t));
  }

  static async delete(token, userId = null, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaDelete(null, null, MetaTable.API_TOKENS, {
      token,
      user_id: userId,
    });
  }

  static async getByToken(token, userId = null, ncMeta = Noco.ncMeta) {
    const data = await ncMeta.metaGet(null, null, MetaTable.API_TOKENS, {
      token,
      user_id: userId,
    });
    return data && new ApiToken(data);
  }
}
