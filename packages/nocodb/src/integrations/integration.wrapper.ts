import { Integration } from '~/models';

export default class IntegrationWrapper extends Integration {
  public onCreateIntegration?(): Promise<any>;
  public onUpdateIntegration?(): Promise<any>;
  public onDeleteIntegration?(): Promise<any>;
}
