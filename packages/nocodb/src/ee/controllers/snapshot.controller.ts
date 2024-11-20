import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { SnapshotService } from '~/services/snapshot.service';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  // TODO: @DarkPhoenix2704 Add ACL
  @Get('/api/v2/meta/bases/:baseId/snapshots')
  async getSnapshots() {
    return await this.snapshotService.getSnapshots();
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Post('/api/v2/meta/bases/:baseId/snapshots')
  async createSnapshot() {
    return await this.snapshotService.createSnapshot();
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Patch('/api/v2/meta/bases/:baseId/snapshots/:snapshotId')
  async updateSnapshot() {
    return await this.snapshotService.updateSnapshot();
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Post('/api/v2/meta/bases/:baseId/snapshots/:snapshotId/restore')
  async restoreSnapshot() {
    return await this.snapshotService.restoreSnapshot();
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Delete('/api/v2/meta/bases/:baseId/snapshots/:snapshotId')
  async deleteSnapshot() {
    return await this.snapshotService.deleteSnapshot();
  }
}
