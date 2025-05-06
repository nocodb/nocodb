import { Injectable, Logger } from '@nestjs/common';
import { DataReflection } from '~/models';
import Noco from '~/Noco';

@Injectable()
export class DataReflectionService {
  protected logger: Logger = new Logger(DataReflectionService.name);

  constructor() {}

  async create(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    const existing = await DataReflection.get({ fk_workspace_id }, ncMeta);

    if (existing) {
      return existing;
    }

    return DataReflection.create(fk_workspace_id, ncMeta);
  }

  async delete(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    return DataReflection.destroy(fk_workspace_id, ncMeta);
  }

  async get(fk_workspace_id: string, ncMeta = Noco.ncMeta) {
    return DataReflection.get({ fk_workspace_id }, ncMeta);
  }
}
