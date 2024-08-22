import { Integration } from '~/models';

export default class IntegrationWrapper extends Integration {
  async callAction(action: string, ...args: any[]): Promise<any> {
    if (this[action]) {
      return this[action](...args);
    }
  }
}
