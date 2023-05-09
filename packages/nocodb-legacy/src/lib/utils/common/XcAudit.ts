import type Noco from '../../Noco';

export default class XcAudit {
  public static init(app: Noco) {
    this.app = app;
  }

  // @ts-ignore
  private static app: Noco;

  // @ts-ignore
  public static async log(data: { project }) {}
}
