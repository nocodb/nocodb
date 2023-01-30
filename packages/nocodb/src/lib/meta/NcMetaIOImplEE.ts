import NcMetaIOImpl from './NcMetaIOImpl';

export default class NcMetaIOImplEE extends NcMetaIOImpl {
  public async audit(
    project_id: string,
    dbAlias: string,
    target: string,
    data: any
  ): Promise<any> {
    return this.metaInsert(project_id, dbAlias, target, data);
  }
}
