import { Injectable } from '@nestjs/common';
import { type UserType, ViewTypes } from 'nocodb-sdk';
import { BaseUser } from '~/models';
import { TablesService } from '~/services/tables.service';
import { deserializeJSON } from '~/utils/serialize';

const viewTypeAlias: Record<number, string> = {
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.MAP]: 'map',
  [ViewTypes.CALENDAR]: 'calendar',
};

@Injectable()
export class CommandPaletteService {
  constructor(private tablesService: TablesService) {}

  async commandPalette(param: { body: any; user: UserType }) {
    const cmdData = [];
    try {
      const allBases = [];

      const bases = await BaseUser.getProjectsList(param.user.id, param);

      allBases.push(...bases);

      const viewList = [];

      for (const base of bases) {
        viewList.push(
          ...(
            (await this.tablesService.xcVisibilityMetaGet(
              { workspace_id: base.fk_workspace_id, base_id: base.id },
              base.id,
              null,
              false,
            )) as any[]
          ).filter((v) => {
            return Object.keys(param.user.roles).some(
              (role) => param.user.roles[role] && !v.disabled[role],
            );
          }),
        );
      }

      const tableList = [];
      const vwList = [];

      for (const b of allBases) {
        cmdData.push({
          id: `p-${b.id}`,
          title: b.title,
          icon: 'project',
          iconColor: deserializeJSON(b.meta)?.iconColor,
          section: 'Bases',
        });
      }

      for (const v of viewList) {
        if (!tableList.find((el) => el.id === `tbl-${v.fk_model_id}`)) {
          tableList.push({
            id: `tbl-${v.fk_model_id}`,
            title: v._ptn,
            parent: `p-${v.base_id}`,
            icon: v?.table_meta?.icon || v.ptype,
            projectName: bases.find((el) => el.id === v.base_id)?.title,
            section: 'Tables',
          });
        }
        vwList.push({
          id: `vw-${v.id}`,
          title: `${v.title}`,
          parent: `tbl-${v.fk_model_id}`,
          icon: v?.meta?.icon || viewTypeAlias[v.type] || 'table',
          projectName: bases.find((el) => el.id === v.base_id)?.title,
          section: 'Views',
          is_default: v?.is_default,
          handler: {
            type: 'navigate',
            payload: `/nc/${v.base_id}/${v.fk_model_id}/${encodeURIComponent(
              v.id,
            )}`,
          },
        });
      }

      cmdData.push(...tableList);
      cmdData.push(...vwList);
    } catch (e) {
      console.log(e);
      return [];
    }
    return cmdData;
  }
}
