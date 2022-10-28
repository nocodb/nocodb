export default interface XcDynamicChanges {
  onTableCreate(tn: string): Promise<void>;
  onTableUpdate(changeObj: any): Promise<void>;
  onTableDelete(tn: string): Promise<void>;
  onTableRename(oldTableName: string, newTableName: string): Promise<void>;
  onHandlerCodeUpdate(tn: string): Promise<void>;
  onMetaUpdate(tn: string): Promise<void>;
}
