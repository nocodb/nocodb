import { Injectable } from '@nestjs/common';

@Injectable()
export class SnapshotService {
  async getSnapshots() {
    return [];
  }

  async createSnapshot() {
    return {};
  }

  async updateSnapshot() {
    return {};
  }

  async restoreSnapshot() {
    return {};
  }

  async deleteSnapshot() {
    return true;
  }
}
