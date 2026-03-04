import { ChatMessagesService as ChatMessagesServiceCE } from 'src/meta/chat-messages.service';
import { Injectable, Optional } from '@nestjs/common';
import XcMigrationSourceChatMessages from '~/meta/migrations/XcMigrationSourceChatMessages';
import { NcConfig } from '~/utils/nc-config';
import { isWorker } from '~/utils';

@Injectable()
export class ChatMessagesService extends ChatMessagesServiceCE {
  constructor(config: NcConfig, @Optional() trx = null) {
    super(config, trx);
  }

  public async init(): Promise<boolean> {
    if (isWorker) {
      return true;
    }

    await this.connection.migrate.latest({
      migrationSource: new XcMigrationSourceChatMessages(),
      tableName: 'xc_knex_migrations_chat_messages',
    });
    return true;
  }
}
