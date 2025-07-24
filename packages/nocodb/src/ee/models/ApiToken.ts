import { ApiToken as ApiTokenCE } from 'src/models';
import SSOClient from './SSOClient';
import Noco from '~/Noco';

export default class ApiToken extends ApiTokenCE {
  async getExtraForUserPayload(
    ncMeta = Noco.ncMeta,
  ): Promise<void | Record<string, any>> {
    if (!this.fk_sso_client_id) return;

    const ssoClient = await SSOClient.get(this.fk_sso_client_id, ncMeta);

    if (!ssoClient) {
      return;
    }

    return {
      org_id: ssoClient.fk_org_id,
      workspace_id: ssoClient.fk_workspace_id,
      sso_client_id: ssoClient.id,
      sso_client_type: ssoClient.type,
    } as Record<string, any>;
  }
}
