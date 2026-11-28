import { Injectable } from '@nestjs/common';

/** CE no-op — AI Apps are EE-only. */
@Injectable()
export class AppMembersPassMigration {
  async job(): Promise<boolean> {
    return true;
  }
}
