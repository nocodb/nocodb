import { Injectable } from '@nestjs/common';
import { UpdateStatsService as UpdateStatsServiceEE } from 'src/ee/services/update-stats.service';

export {
  UPDATE_WORKSPACE_STAT,
  UPDATE_WORKSPACE_COUNTER,
} from 'src/ee/services/update-stats.service';

@Injectable()
export class UpdateStatsService extends UpdateStatsServiceEE {
  override onModuleInit() {
    // noop — stats tracking is not needed for on-prem
  }
}
