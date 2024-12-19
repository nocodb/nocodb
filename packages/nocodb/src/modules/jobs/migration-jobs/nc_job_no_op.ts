import { Injectable } from '@nestjs/common';

@Injectable()
export class NoOpMigration {
  async job() {
    return true;
  }
}
