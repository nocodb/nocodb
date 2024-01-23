import { Injectable } from '@nestjs/common';
import { type UserType, ViewTypes } from 'nocodb-sdk';
import { Base } from '~/models';
import { TablesService } from '~/services/tables.service';

const viewTypeAlias: Record<number, string> = {
  [ViewTypes.GRID]: 'grid',
  [ViewTypes.FORM]: 'form',
  [ViewTypes.GALLERY]: 'gallery',
  [ViewTypes.KANBAN]: 'kanban',
  [ViewTypes.MAP]: 'map',
};

@Injectable()
export class CommandPaletteService {
  constructor(private tablesService: TablesService) {}

  async commandPalette(param: { body: any; user: UserType }) {
    const cmdData = [];
    try {
      const { scope, data } = param.body;

      console.log('param.user.id', param.user, scope, data);

      if (scope === 'root') {
        const bases = await Base.list({ user: param.user });
        console.log('bases', bases);

        for (const base of bases) {
          cmdData.push({
            id: `p-${base.id}`,
            title: base.title,
            icon: 'project',
            section: 'Bases',
            scopePayload: {
              scope: `p-${base.id}`,
              data: {
                base_id: base.id,
              },
            },
          });
        }

        console.log('scope');
      } else if (scope.startsWith('p-')) {
        const allBases = [];

        const bases = await Base.list({ user: param.user });
        console.log('bases', bases);

        allBases.push(...bases);

        const viewList = [];

        for (const base of bases) {
          viewList.push(
            ...(
              (await this.tablesService.xcVisibilityMetaGet(
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
      }
    } catch (e) {
      console.log(e);
      return [];
    }
    return cmdData;
  }
}
