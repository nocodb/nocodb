// @ts-ignore
import type { XcEmail } from '../../../../../interface/IEmailAdapter';
import type IEmailAdapter from '../../../../../interface/IEmailAdapter';

export default // @ts-ignore
class SES implements IEmailAdapter {
  // @ts-ignore
  private input: any;

  constructor(input: any) {
    this.input = input;
  }

  public async init(): Promise<any> {}

  public async mailSend(_mail: XcEmail): Promise<any> {}

  test(_email): Promise<boolean> {
    return Promise.resolve(false);
  }
}
