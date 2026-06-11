import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { User, Workspace } from '~/models';
import { calculateInstanceEditorCount } from '~/helpers/instanceAdminHelpers';

@Injectable()
export class InstanceAdminGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  operations = [
    'instanceAdminStats' as const,
    'instanceAdminWorkspaces' as const,
    'instanceAdminBases' as const,
  ];
  httpMethod = 'GET' as const;

  async handle(
    _context: NcContext,
    {
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'instanceAdminStats':
        return this.getStats();
      case 'instanceAdminWorkspaces':
        return this.getWorkspaces();
      case 'instanceAdminBases':
        return this.getBases();
    }
  }

  private async getStats() {
    const ncMeta = Noco.ncMeta;

    const [totalWorkspaces, totalUsers, editorCount, baseCountResult] =
      await Promise.all([
        Workspace.count({ deleted: false }),
        User.count({}),
        calculateInstanceEditorCount(),
        ncMeta
          .knexConnection(MetaTable.PROJECT)
          .where(function () {
            this.where('deleted', false).orWhereNull('deleted');
          })
          .andWhere(function () {
            this.where('is_snapshot', false).orWhereNull('is_snapshot');
          })
          .count('id as count')
          .first(),
      ]);

    return {
      totalWorkspaces,
      totalBases: Number(baseCountResult?.count ?? 0),
      totalUsers,
      editorCount,
    };
  }

  private async getWorkspaces() {
    const ncMeta = Noco.ncMeta;

    const workspaces = await ncMeta.knexConnection
      .select(
        `${MetaTable.WORKSPACE}.id`,
        `${MetaTable.WORKSPACE}.title`,
        `${MetaTable.WORKSPACE}.meta`,
      )
      .select(ncMeta.knex.raw(`COALESCE(mc.member_count, 0) as "memberCount"`))
      .select(ncMeta.knex.raw(`COALESCE(bc.base_count, 0) as "baseCount"`))
      .from(MetaTable.WORKSPACE)
      .leftJoin(
        ncMeta.knex
          .select('fk_workspace_id')
          .count('* as member_count')
          .from(MetaTable.WORKSPACE_USER)
          .where(function () {
            this.where('deleted', false).orWhereNull('deleted');
          })
          .groupBy('fk_workspace_id')
          .as('mc'),
        'mc.fk_workspace_id',
        `${MetaTable.WORKSPACE}.id`,
      )
      .leftJoin(
        ncMeta.knex
          .select('fk_workspace_id')
          .count('* as base_count')
          .from(MetaTable.PROJECT)
          .where(function () {
            this.where('deleted', false).orWhereNull('deleted');
          })
          .andWhere(function () {
            this.where('is_snapshot', false).orWhereNull('is_snapshot');
          })
          .groupBy('fk_workspace_id')
          .as('bc'),
        'bc.fk_workspace_id',
        `${MetaTable.WORKSPACE}.id`,
      )
      .where(function () {
        this.where(`${MetaTable.WORKSPACE}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE}.deleted`,
        );
      })
      .orderBy(`${MetaTable.WORKSPACE}.title`, 'asc');

    return workspaces.map((ws: any) => ({
      ...ws,
      memberCount: Number(ws.memberCount),
      baseCount: Number(ws.baseCount),
    }));
  }

  private async getBases() {
    const ncMeta = Noco.ncMeta;

    const bases = await ncMeta.knexConnection
      .select(
        `${MetaTable.PROJECT}.id`,
        `${MetaTable.PROJECT}.title`,
        `${MetaTable.PROJECT}.meta`,
        `${MetaTable.PROJECT}.fk_workspace_id as workspace_id`,
        `${MetaTable.WORKSPACE}.title as workspace_title`,
        `${MetaTable.WORKSPACE}.meta as workspace_meta`,
      )
      .select(ncMeta.knex.raw(`COALESCE(mc.member_count, 0) as "memberCount"`))
      .from(MetaTable.PROJECT)
      .leftJoin(
        MetaTable.WORKSPACE,
        `${MetaTable.PROJECT}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .leftJoin(
        ncMeta.knex
          .select('base_id')
          .count('* as member_count')
          .from(MetaTable.PROJECT_USERS)
          .groupBy('base_id')
          .as('mc'),
        'mc.base_id',
        `${MetaTable.PROJECT}.id`,
      )
      .where(function () {
        this.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
      })
      .andWhere(function () {
        this.where(`${MetaTable.PROJECT}.is_snapshot`, false).orWhereNull(
          `${MetaTable.PROJECT}.is_snapshot`,
        );
      })
      .orderBy(`${MetaTable.PROJECT}.title`, 'asc');

    return bases.map((base: any) => ({
      ...base,
      memberCount: Number(base.memberCount),
    }));
  }
}
