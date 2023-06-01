import Connection from "mysql2/typings/mysql/lib/Connection";
import { Base, Hook, Model, Project } from "../../models";
import { XKnex } from "../../db/sql-data-mapper";
import { merge, isEqual } from "lodash";
import EventEmitter from "events";
import { MetaTable } from "../../utils/globals";
import type NcMetaIO from "../../meta/NcMetaIO";
import NcConnectionMgrv2 from "../../utils/common/NcConnectionMgrv2";
import { HookType } from "nocodb-sdk";
import getAst from "../../db/sql-data-mapper/lib/sql/helpers/getAst";
import { nocoExecute } from 'nc-help';
import { sanitize } from "../../db/sql-data-mapper/lib/sql/helpers/sanitize";
import { invokeWebhook } from "../../meta/helpers/webhookHelpers";

export type PSQLRecordOperationEvent = {
  base: Base;
  operation: 'delete' | 'create' | 'update',
  model: Model;
  oldData: Record<string, any>;
  newData: Record<string, any>;
};

type IBaseData = {
  base: Base;
  models: Model[];
  knex: XKnex;
  connectionOptions: {[k: string]: any; database: string;};
  throttleTaskId?: ReturnType<typeof setTimeout> | null;
};

type ISQLNotificationData = {
  channel: string;
  payload: string;
};

export class PSQLRecordOperationWatcher extends EventEmitter {
  public readonly recordOperationEventType = 'record-operation';
  private readonly rewatchErrorRetryDelayMillis = 3000;
  private readonly throttleDelayMillis = 5000;
  private readonly consumptionBatchCount = 30;

  // NOTE: the objects stored here are used for compare by reference in various parts of the program
  private readonly allBaseData: Map<string, IBaseData> = new Map();

  constructor(private ncMeta: NcMetaIO){
    super();
  }

  private throttleAndConsumeNotifications(baseData: IBaseData, delayMillis?: number){
    if(baseData.throttleTaskId != undefined) return;

    baseData.throttleTaskId = setTimeout(()=>{
      this.consumeNotifications(baseData);
    }, delayMillis || this.throttleDelayMillis);
  }

  private async convertDBDataToModelData( baseData: IBaseData, model: Model, dbData: Record<string, any> ){
    const columns = await model.getColumns();

    let modelData = columns.reduce( (modelData, column ) => ({
      ...modelData,
      [sanitize(column.title || column.column_name)]: sanitize(
        dbData[column.column_name]
      ),
    }), {} as Record<string, any> );

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(baseData.base),
    });

    if (modelData) {
      const proto = await baseModel.getProto();
      modelData.__proto__ = proto;
    }

    // retrieve virtual column data as well
    const { ast } = await getAst({ model });
    modelData = await nocoExecute(ast, modelData, {});
    return modelData;
  }

  // should be called by throttle task
  private async consumeNotifications (baseData: IBaseData, forDestroy = false){
    const notificationsTableName = this.createSqlIdentifier(baseData, 'notifications_table');

    const perPage = this.consumptionBatchCount;

    const countResult = await baseData.knex(notificationsTableName).count({count: '*'});
    const numOfRows = +countResult[0]?.count || 0;

    if( numOfRows <= perPage ){
      baseData.throttleTaskId = null;
    }

    const notifications: {
      id: string;
      createdAt: string;
      nocodbModelId: string;
      operation: string;
      oldData?: Record<string, any> | null;
      newData?: Record<string, any> | null;
      numOfRows: number;
    }[] = await baseData.knex(notificationsTableName)
      .whereIn('id', baseData.knex(notificationsTableName).select('id').limit(perPage))
      .returning('*')
      .delete();

    if( numOfRows > perPage ){
      const consumeNotificationsPromise = this.consumeNotifications(baseData);
      if(forDestroy) await consumeNotificationsPromise;
    }

    await Promise.all(
      notifications.map( async ({
        nocodbModelId,
        operation,
        oldData: oldDBData,
        newData: newDBData,
      }) => {
        const model = baseData.models.find( model => model.id === nocodbModelId );
        if(!model) {
          // TODO: Log this error
          return;
        }
        
        const oldData = oldDBData ? await this.convertDBDataToModelData(baseData, model,oldDBData) : oldDBData;
        const newData = newDBData ? await this.convertDBDataToModelData(baseData, model,newDBData) : newDBData;

        const eventData: PSQLRecordOperationEvent = {
          base: baseData.base,
          oldData,
          newData,
          operation: operation as PSQLRecordOperationEvent['operation'],
          model,
        };

        this.emit(this.recordOperationEventType, eventData);
      })
    );
  }

  private async registerListeners ( baseDataForRef: IBaseData, connection: Connection ) {
    let rewatchHandled = false;

    const notificationChannel = this.getSqlNotificationChannel(baseDataForRef);

    const listeningQuery = `LISTEN ${notificationChannel}`;
    await connection.query(listeningQuery);

    connection.on('notification', (data: ISQLNotificationData) => {
      const notificationChannel = this.getSqlNotificationChannel(baseDataForRef);

      const {channel } = data;

      if( channel !== notificationChannel) return;
  
      // get the current baseData, it might be different from what was used in last notification because it was updated in the bases map
      const baseData = this.allBaseData.get(baseDataForRef.base.id);
  
      if( !baseData ) return;
  
      // if not equal by reference, then do nothing. the baseData object that registered this listener has been replaced. Maybe the connection notification 
      // event still fired because the connection object is just starting to be destroyed
      if( baseData !== baseDataForRef) return;
  
      this.throttleAndConsumeNotifications(baseData);
    });

    const endListener = () => {
      if(rewatchHandled) return;
      rewatchHandled = true;
      const rewatch = () => {
        const baseData = this.allBaseData.get(baseDataForRef.base.id);
      
        // if not equal by reference, then do nothing. the baseData object that registered this listener has been replaced.
        if( baseData !== baseDataForRef ) return;

        this._watchBaseInternal(baseData.base, true).catch(() => {
          // TODO: Log this sensitive error and report as incident, this could cause events to be missed

          // retry after a delay.
          setTimeout(rewatch, this.rewatchErrorRetryDelayMillis);
        });
      };

      rewatch();
    };

    connection.on('end', endListener);
    connection.on('error', endListener);
  };

  private getSqlNotificationChannel (baseData: IBaseData) {
    return this.createSqlIdentifier(baseData, 'notification_channel');
  }

  private createSqlIdentifier ( baseData: IBaseData, suffix: string,) {
    return `esa_nocodb__${baseData.connectionOptions.database}__${suffix}`.toLowerCase();
  };

  private async setupSQLResources (baseData: IBaseData, models: Model[]) {
    const notificationChannel = this.getSqlNotificationChannel(baseData);

    const notificationsTableName = this.createSqlIdentifier(baseData, 'notifications_table');

    const notificationsTableCreateQuery = `
    CREATE TABLE IF NOT EXISTS "${notificationsTableName}" ( "id" SERIAL PRIMARY KEY, "operation" VARCHAR(20) NOT NULL, "nocodbModelId" VARCHAR(30) NOT NULL, "oldData" JSONB, "newData" JSONB, "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP );
    `;

    await baseData.knex.raw(notificationsTableCreateQuery);

    const procedureName = this.createSqlIdentifier(baseData, 'function');
    const procedureQuery = `
    CREATE OR REPLACE FUNCTION ${procedureName}() RETURNS TRIGGER AS $trigger$
    DECLARE
      model_id TEXT;
    BEGIN
      model_id := TG_ARGV[0];

      INSERT INTO "${notificationsTableName}"( "operation", "nocodbModelId", "oldData", "newData" ) VALUES ( LOWER(TG_OP)::VARCHAR, model_id::VARCHAR,row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB );

      NOTIFY ${notificationChannel};

      IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
      ELSIF (TG_OP = 'UPDATE' OR TG_OP = 'INSERT') THEN
        RETURN NEW;
      END IF;

      RETURN NULL;
    END;
    $trigger$ LANGUAGE plpgsql;
    `;
    await baseData.knex.raw(procedureQuery);

    for( const {id: modelId, table_name: tableName} of models){
      const triggerName = this.createSqlIdentifier(baseData, `${tableName}__trigger`);

      // postgressql does not have "create or replace" statement for function, hence that can be suffixed by first dropping it
      const dropTriggerQuery = `DROP TRIGGER IF EXISTS "${triggerName}" on "${tableName}"`;

      // use a constraint trigger so that if a transaction is active, the events are fired only after the transaction is successful
      const createTriggerQuery = `
      CREATE CONSTRAINT TRIGGER "${triggerName}"
      AFTER INSERT OR UPDATE OR DELETE ON "${tableName}"
      DEFERRABLE
      INITIALLY DEFERRED
      FOR EACH ROW EXECUTE PROCEDURE ${procedureName}('${modelId}');
      `;
      await baseData.knex.raw(dropTriggerQuery);
      await baseData.knex.raw(createTriggerQuery);
    }
  }

  private async disposeSQLResourcesForModel (baseData: IBaseData, {table_name: tableName}: Model) {
    const oldTriggerName = this.createSqlIdentifier(baseData, `${tableName}__trigger`);
    const dropOldTriggerQuery = `DROP TRIGGER IF EXISTS ${oldTriggerName} on ${tableName}`;
    await baseData.knex.raw(dropOldTriggerQuery);
  }

  private async disposeSQLResources (baseData: IBaseData) {
    const notificationsTableName = this.createSqlIdentifier(baseData, 'notifications_table');
    const notificationsTableCreateQuery = `
    DROP TABLE IF EXISTS "${notificationsTableName}";
    `;
    await baseData.knex.raw(notificationsTableCreateQuery);

    const oldProcedureName = this.createSqlIdentifier(baseData, 'function');
    const oldProcedureQuery = `DROP FUNCTION IF EXISTS ${oldProcedureName}`;
    await baseData.knex.raw(oldProcedureQuery);

    for(const model of baseData.models){
      await this.disposeSQLResourcesForModel(baseData, model);
    }
  }

  /**
   * should be called when a base is created OR when tables are created, updated or delete in a base.
   * @param base 
   */
  async watchBase( base: Base ){
    return this._watchBaseInternal(base, false);
  }

  private async _watchBaseInternal( base: Base, rewatch: boolean ){
    if(!base.id){
      // TODO: Log this error and report as incident
      return;
    }
    
    const foundModelData: Record<string, any>[] = await this.ncMeta.metaList2(
      base.project_id,
      base.id,
      MetaTable.MODELS,
    );

    const models = foundModelData.map(foundModelDatum => new Model(foundModelDatum));

    const obsoleteModels: Model[] = [];
    const newModels: Model[] = [];

    let baseData:IBaseData = this.allBaseData.get(base.id);

    const connectionOptions = (await base.getConnectionConfig()).connection;

    const createNewBaseData = 
      !baseData || 
      // if connection options have changed which includes database name, port, host etc.
      !isEqual(connectionOptions, baseData.connectionOptions);

    if(baseData && createNewBaseData){
      // will dispose all resources
      await this.unwatchBase(baseData.base);
    }

    if(createNewBaseData){
      const knex = await this.createKnex(base);
      baseData = {
        base,
        models,
        knex,
        connectionOptions,
      };

      newModels.push(...models);
    }
    else{
      const modelIds = models.map(model => model.table_name);
      obsoleteModels.push(...baseData.models.filter((model) => !modelIds.includes(model.id)));
      const prevModelIds = baseData.models.map(model => model.id);
      newModels.push(...models.filter((model) => !prevModelIds.includes(model.id)));

      baseData.base = base;
      baseData.models = models;
    }

    await this.setupSQLResources(baseData, newModels);

    void this.consumeNotifications(baseData);

    if(createNewBaseData || rewatch){
      const connection = await baseData.knex.client.acquireConnection();

      // start watching
      await this.registerListeners(baseData, connection);
    }

    await Promise.all(obsoleteModels.map( obsoleteModel => this.disposeSQLResourcesForModel(baseData, obsoleteModel) ));

    this.allBaseData.set(base.id, baseData);
  }

  async unwatchBase( base: Base){
    const baseData = this.allBaseData.get(base.id);
    if(baseData){
      if(baseData.throttleTaskId != undefined) {
        clearTimeout(baseData.throttleTaskId);
        baseData.throttleTaskId = null;
      }

      try{
        await this.consumeNotifications(baseData, true);
      }
      catch{};

      // delete first before destroying all connections, so that a rewatch wont be attempted if connection.end event is fired
      this.allBaseData.delete(base.id);
      await this.disposeSQLResources(baseData);

      await baseData.knex.destroy();
    }
  }

  async watchAllBases () {
    const projects = await Project.list({});
    const bases = (await Promise.all(projects.map(project => project.getBases()))).flat();
    const baseIds = bases.map( base => base.id );

    const allObsoleteBaseData = Array.from(this.allBaseData.values()).filter( baseData => !baseIds.includes( baseData.base.id ) );

    for( const base of bases ){
      await this.watchBase(base);
    }

    for( const obsoleteBaseData of allObsoleteBaseData ){
      await this.unwatchBase(obsoleteBaseData.base);
    }
  };

  private async createKnex(base: Base): Promise<XKnex> {
    const connectionConfig = await base.getConnectionConfig();
    const options = merge(connectionConfig, {
      pool: {
        min: 0, max: 3,
      }
    });
    return XKnex(options);
  }

  static defaultInstance: PSQLRecordOperationWatcher;
  static async watchForWebhook( ncMeta: NcMetaIO ){
    const recordOperationWatcher = new PSQLRecordOperationWatcher(ncMeta);
    PSQLRecordOperationWatcher.defaultInstance = recordOperationWatcher;

    recordOperationWatcher.on(recordOperationWatcher.recordOperationEventType, async ({model, operation, oldData, newData}: PSQLRecordOperationEvent)=>{
      const theOperation = operation as HookType['operation'];
      const event = 'after';

      if( theOperation === 'delete' ){
        newData = oldData;
        oldData = null;
      }

      try {
        const hooks = await Hook.list({
          fk_model_id: model.id,
          event,
          operation: theOperation,
        });
        for (const hook of hooks) {
          if (hook.active) {
            invokeWebhook(hook, model, undefined, oldData, newData, undefined);
          }
        }
      } catch (e) {
        const hookName = `${event}.${operation}`;
        console.log('PSQLRecordEvent : hooks :: error', hookName, e);
      }
    });

    await recordOperationWatcher.watchAllBases();
  }
}
