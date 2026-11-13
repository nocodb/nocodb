import { Injectable } from '@nestjs/common';

/** CE no-op — environments are EE-only. */
@Injectable()
export class EnvironmentChangelogSecretCleanupMigration {
  async job(): Promise<boolean> {
    return true;
  }
}
