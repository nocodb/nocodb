import NocoCE from 'src/Noco';
import type { INestApplication } from '@nestjs/common';
import type { MetaService } from '~/meta/meta.service';
import { NcLogger } from '~/utils/logger/NcLogger';
import { AuditService } from '~/meta/audit.service';
import { ChatMessagesService } from '~/meta/chat-messages.service';
import { NcConfig } from '~/utils/nc-config';
import { MetaTable } from '~/utils/globals';
export default class Noco extends NocoCE {
  protected static initCustomLogger(nestApp: INestApplication) {
    this.ee = true;
    nestApp.useLogger(nestApp.get(NcLogger));
  }

  public get ncMeta(): MetaService {
    return Noco._ncMeta;
  }

  public static isEE(): boolean {
    return this.ee;
  }

  public static async prepareAuditService() {
    if (process.env.NC_AUDIT_DB) {
      const auditConfig = await NcConfig.create({
        meta: {
          metaUrl: process.env.NC_AUDIT_DB,
        },
      });
      Noco._ncAudit = new AuditService(auditConfig);

      const migrateAudit = !(await Noco.ncAudit.knexConnection.schema.hasTable(
        MetaTable.AUDIT,
      ));

      await Noco.ncAudit.init();

      if (migrateAudit) {
        await this.migrateAuditFromMeta();
      }
    }
  }

  public static async prepareChatMessagesService() {
    if (process.env.NC_CHAT_DB) {
      const chatConfig = await NcConfig.create({
        meta: {
          metaUrl: process.env.NC_CHAT_DB,
        },
      });

      Noco._ncChatMessages = new ChatMessagesService(chatConfig);

      const migrateChatMessages =
        !(await Noco.ncChatMessages.knexConnection.schema.hasTable(
          MetaTable.CHAT_MESSAGES,
        ));

      await Noco.ncChatMessages.init();

      if (migrateChatMessages) {
        await this.migrateChatMessagesFromMeta();
      }
    }
  }

  private static async migrateChatMessagesFromMeta() {
    const batchSize = 500;
    let offset = 0;
    let processedCount = 0;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
      const batch = await Noco.ncMeta
        .knexConnection(MetaTable.CHAT_MESSAGES)
        .select('*')
        .orderBy('id', 'asc')
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) {
        hasMoreRecords = false;
        break;
      }

      await Noco.ncChatMessages
        .knexConnection(MetaTable.CHAT_MESSAGES)
        .insert(batch);

      processedCount += batch.length;
      offset += batchSize;

      if (batch.length < batchSize) {
        hasMoreRecords = false;
      }
    }
  }

  private static async migrateAuditFromMeta() {
    await this.migrateAuditTable(MetaTable.AUDIT);

    // This is commented out for safety - uncomment to clean up the source
    // await Noco.ncMeta.knexConnection(MetaTable.AUDIT).del();
    // console.log('Cleared audit records from ncMeta after successful migration.');
  }

  private static async migrateAuditTable(table: MetaTable.AUDIT) {
    // Migration configuration
    const batchSize = 500;

    let offset = 0;
    let processedCount = 0;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
      // Fetch records in small batches with offset
      const batch = await Noco.ncMeta
        .knexConnection(table)
        .select('*')
        .orderBy('id', 'asc')
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) {
        hasMoreRecords = false;
        break;
      }

      const auditRecords = [];

      auditRecords.push(...batch);

      if (auditRecords.length > 0) {
        await Noco.ncAudit.knexConnection(table).insert(auditRecords);
      }

      processedCount += batch.length;
      offset += batchSize;

      // Log progress every 10,000 records
      if (processedCount % 10000 === 0) {
        console.log(`Migrated ${processedCount} audit records...`);
      }

      // If we got fewer records than batch size, we're done
      if (batch.length < batchSize) {
        console.log(
          `Migration of ${table} completed. Migrated ${processedCount} audit records...`,
        );
        hasMoreRecords = false;
      }
    }
  }
}
