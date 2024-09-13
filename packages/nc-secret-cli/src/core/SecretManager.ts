import {NcError} from "./NcError";

const { SqlClientFactory, MetaTable, decryptPropIfRequired, encryptPropIfRequired } =  require('../nocodb/cli')

export class SecretManager {

  private sqlClient;

  constructor(private oldSecret: string, private newSecret: string, private config: any) {
    this.sqlClient = SqlClientFactory.create(this.config.meta.db);
  }


  // validate config by checking if database config is valid
  async validateConfig() {
    // use the sqlClientFactory to create a new sql client and then use testConnection to test the connection
    const isValid = await this.sqlClient.testConnection();
    if (!isValid) {
      throw new NcError('Invalid database configuration');
    }
  }


  async validateAndExtract() {
    // check if tables are present in the database
    if (!(await this.sqlClient.knex.schema.hasTable(MetaTable.SOURCES))) {
      throw new NcError('Sources table not found');
    }

    if (!(await this.sqlClient.knex.schema.hasTable(MetaTable.INTEGRATIONS))) {
      throw new NcError('Integrations table not found');
    }

    // if is_encrypted column is not present in the sources table then throw an error
    if(
      !(await this.sqlClient.knex.schema.hasColumn(MetaTable.SOURCES, 'is_encrypted')) ||
      !(await this.sqlClient.knex.schema.hasColumn(MetaTable.INTEGRATIONS, 'is_encrypted'))){
      throw new NcError('Looks like you are using an older version of NocoDB. Please upgrade to the latest version and try again.');
    }


    const sources = await this.sqlClient.knex(MetaTable.SOURCES).where(qb => {
      qb.where('is_meta', false).orWhere('is_meta', null)
    });

    const integrations = await this.sqlClient.knex(MetaTable.INTEGRATIONS);

    const sourcesToUpdate: Record<string, any>[] = [];
    const integrationsToUpdate: Record<string, any>[] = [];


    let isValid = false;
    for (const source of sources) {
      try {
        const decrypted = decryptPropIfRequired({
          data: source,
          secret: this.oldSecret,
          prop: 'config'
        });
        isValid = true;
        sourcesToUpdate.push({ ...source, config: decrypted });
      } catch (e) {
        console.log(e);
      }
    }

    for (const integration of integrations) {
      try {
        const decrypted = decryptPropIfRequired({
          data: integration,
          secret: this.oldSecret,
          prop: 'config'
        });
        isValid = true;
        integrationsToUpdate.push({ ...integration, config: decrypted });
      } catch (e) {
        console.log(e);
      }
    }

    // if all of the decyptions are failed then throw an error
    if (!isValid) {
      throw new NcError('Invalid old secret or no sources/integrations found');
    }



    return { sourcesToUpdate, integrationsToUpdate };
  }


  async updateSecret(
    sourcesToUpdate: Record<string, any>[],
    integrationsToUpdate: Record<string, any>[]
  ) {
    // start transaction
    const transaction = await this.sqlClient.transaction();

    try {
      //  update sources
      for (const source of sourcesToUpdate) {
        await transaction(MetaTable.SOURCES).update({
          config: encryptPropIfRequired({
            data: source,
            secret: this.newSecret,
            prop: 'config'
          })
        }).where('id', source.id);
      }

      // update integrations
      for (const integration of integrationsToUpdate) {
        await transaction(MetaTable.INTEGRATIONS).update({
          config: encryptPropIfRequired({
            data: integration,
            secret: this.newSecret,
            prop: 'config'
          })
        }).where('id', integration.id);
      }

      await transaction.commit();

    } catch (e) {
      console.log(e);
      await transaction.rollback();
      throw e;
    }
  }
}
