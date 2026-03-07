import NocoCE from 'src/Noco';
import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { MetaService } from '~/meta/meta.service';
import { NcLogger } from '~/utils/logger/NcLogger';
import { AuditService } from '~/meta/audit.service';
import { ChatMessagesService } from '~/meta/chat-messages.service';
import { DocsContentService } from '~/meta/docs-content.service';
import { NcConfig } from '~/utils/nc-config';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('Noco');
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
      this._ncAudit = new AuditService(auditConfig);

      const migrateAudit = !(await this.ncAudit.knexConnection.schema.hasTable(
        MetaTable.AUDIT,
      ));

      await this.ncAudit.init();

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

      this._ncChatMessages = new ChatMessagesService(chatConfig);

      const migrateChatMessages =
        !(await this.ncChatMessages.knexConnection.schema.hasTable(
          MetaTable.CHAT_MESSAGES,
        ));

      await this.ncChatMessages.init();

      if (migrateChatMessages) {
        await this.migrateChatMessagesFromMeta();
      }
    }
  }

  public static async prepareDocsContentService() {
    if (process.env.NC_DOCS_DB) {
      const docsContentConfig = await NcConfig.create({
        meta: {
          metaUrl: process.env.NC_DOCS_DB,
        },
      });
      this._ncDocsContent = new DocsContentService(docsContentConfig);

      const migrateContent =
        !(await this.ncDocsContent.knexConnection.schema.hasTable(
          MetaTable.DOC_CONTENT,
        ));

      await this.ncDocsContent.init();

      if (migrateContent) {
        await this.migrateDocsContentFromMeta();
      }
    }
  }

  private static async migrateChatMessagesFromMeta() {
    const batchSize = 500;
    let offset = 0;
    let processedCount = 0;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
      const batch = await this.ncMeta
        .knexConnection(MetaTable.CHAT_MESSAGES)
        .select('*')
        .orderBy('id', 'asc')
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) {
        hasMoreRecords = false;
        break;
      }

      await this.ncChatMessages
        .knexConnection(MetaTable.CHAT_MESSAGES)
        .insert(batch);

      processedCount += batch.length;
      offset += batchSize;

      if (processedCount % 10000 === 0) {
        logger.log(`Migrated ${processedCount} chat message records...`);
      }

      if (batch.length < batchSize) {
        logger.log(
          `Migration of chat messages completed. Migrated ${processedCount} records.`,
        );
        hasMoreRecords = false;
      }
    }
  }

  private static async migrateDocsContentFromMeta() {
    // Only migrate if nc_docs_v2 has a content column (pre-split schema)
    const hasContentCol = await this.ncMeta.knexConnection.schema.hasColumn(
      MetaTable.DOCS,
      'content',
    );
    if (!hasContentCol) return;

    const batchSize = 500;
    let offset = 0;
    let processedCount = 0;
    let hasMoreRecords = true;

    while (hasMoreRecords) {
      const batch = await this.ncMeta
        .knexConnection(MetaTable.DOCS)
        .select('id', 'base_id', 'fk_workspace_id', 'content')
        .whereNotNull('content')
        .orderBy('id', 'asc')
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) {
        hasMoreRecords = false;
        break;
      }

      const contentRows = batch.map((row) => ({
        fk_doc_id: row.id,
        base_id: row.base_id,
        fk_workspace_id: row.fk_workspace_id,
        content: row.content,
      }));

      if (contentRows.length > 0) {
        await this.ncDocsContent
          .knexConnection(MetaTable.DOC_CONTENT)
          .insert(contentRows);
      }

      processedCount += batch.length;
      offset += batchSize;

      if (processedCount % 10000 === 0) {
        logger.log(`Migrated ${processedCount} document content records...`);
      }

      if (batch.length < batchSize) {
        logger.log(
          `Migration of doc content completed. Migrated ${processedCount} records.`,
        );
        hasMoreRecords = false;
      }
    }
  }

  private static async migrateAuditFromMeta() {
    await this.migrateAuditTable(MetaTable.AUDIT);

    // This is commented out for safety - uncomment to clean up the source
    // await this.ncMeta.knexConnection(MetaTable.AUDIT).del();
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
      const batch = await this.ncMeta
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
        await this.ncAudit.knexConnection(table).insert(auditRecords);
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
