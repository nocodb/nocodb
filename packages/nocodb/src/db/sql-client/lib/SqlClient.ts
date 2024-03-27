class SqlClient {
  protected connectionConfig: any;
  protected sqlClient: any;
  protected queries: any;
  protected _version: any;

  constructor(connectionConfig) {
    this.connectionConfig = connectionConfig;
    this.sqlClient = null;
  }

  async testConnection(_args): Promise<any> {}

  migrationInit(_args) {}

  migrationUp(_args) {}

  migrationDown(_args) {}

  selectAll(_tn) {}

  executeSqlFiles() {}

  async createDatabaseIfNotExists(_args): Promise<any> {}

  async createTableIfNotExists(_args): Promise<any> {}

  startTransaction() {}

  commit() {}

  rollback() {}

  hasTable(_tn) {}

  hasDatabase(_databaseName) {}

  async tableCreate(_args): Promise<any> {}

  async tableUpdate(_args): Promise<any> {}

  async columnCreate(_args): Promise<any> {}

  async columnUpdate(_args): Promise<any> {}

  async columnDelete(_args): Promise<any> {}

  async indexCreate(_args): Promise<any> {}

  async indexUpdate(_args): Promise<any> {}

  async indexDelete(_args): Promise<any> {}

  async relationCreate(_args): Promise<any> {}

  async relationUpdate(_args): Promise<any> {}

  async relationDelete(_args): Promise<any> {}

  async databaseList(_args): Promise<any> {}

  async tableList(_args): Promise<any> {}

  async schemaList(_args): Promise<any> {}

  async tableDelete(_args): Promise<any> {}

  async columnList(_args): Promise<any> {}

  async indexList(_args): Promise<any> {}

  async relationList(_args): Promise<any> {}

  async schemaCreate(_args): Promise<any> {}

  async schemaDelete(_args): Promise<any> {}

  async triggerList(_args): Promise<any> {}

  async triggerCreate(_args): Promise<any> {}

  async triggerRead(_args): Promise<any> {}

  async functionList(_args): Promise<any> {}

  async functionRead(_args): Promise<any> {}

  async procedureList(_args): Promise<any> {}

  async procedureRead(_args): Promise<any> {}

  async viewList(_args): Promise<any> {}

  async viewRead(_args): Promise<any> {}

  async sequenceList(_args = {}): Promise<any> {}
  async sequenceCreate(_args = {}): Promise<any> {}
  async sequenceUpdate(_args = {}): Promise<any> {}
  async sequenceDelete(_args = {}): Promise<any> {}

  async tableCreateStatement(_args): Promise<any> {}

  async tableInsertStatement(_args): Promise<any> {}

  async tableUpdateStatement(_args): Promise<any> {}

  async tableDeleteStatement(_args): Promise<any> {}

  async tableTruncateStatement(_args): Promise<any> {}

  async tableSelectStatement(_args): Promise<any> {}

  async totalRecords(_args?): Promise<any> {}

  async getDefaultByteaOutputFormat(_args = {}): Promise<any> {}
}

export default SqlClient;
