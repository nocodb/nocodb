import { Injectable } from '@nestjs/common';
import {
  ErrorMessages,
  LinkToAnotherRecordType,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { NcError } from '../../helpers/catchError';
import {
  Base,
  Column,
  LinkToAnotherRecordColumn,
  Model,
  Project,
  View,
} from '../../models';

@Injectable()
export class PublicMetasService {
  async viewMetaGet(param: { sharedViewUuid: string; password: string }) {
    const view: View & {
      relatedMetas?: { [ket: string]: Model };
      client?: string;
    } = await View.getByUUID(param.sharedViewUuid);

    if (!view) NcError.notFound('Not found');

    if (view.password && view.password !== param.password) {
      NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    await view.getFilters();
    await view.getSorts();

    await view.getViewWithInfo();
    await view.getColumns();
    await view.getModelWithInfo();
    await view.model.getColumns();

    const base = await Base.get(view.model.base_id);
    view.client = base.type;

    // todo: return only required props
    delete view['password'];

    view.model.columns = view.columns
      .filter((c) => {
        const column = view.model.columnsById[c.fk_column_id];
        return (
          c.show ||
          (column.rqd && !column.cdf && !column.ai) ||
          column.pk ||
          view.model.columns.some(
            (c1) =>
              c1.uidt === UITypes.LinkToAnotherRecord &&
              (<LinkToAnotherRecordColumn>c1.colOptions).type ===
                RelationTypes.BELONGS_TO &&
              view.columns.some((vc) => vc.fk_column_id === c1.id && vc.show) &&
              (<LinkToAnotherRecordColumn>c1.colOptions).fk_child_column_id ===
                c.fk_column_id,
          )
        );
      })
      .map(
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
      ) as any;

    const relatedMetas = {};

    // load related table metas
    for (const col of view.model.columns) {
      if (UITypes.LinkToAnotherRecord === col.uidt) {
        const colOpt = await col.getColOptions<LinkToAnotherRecordType>();
        relatedMetas[colOpt.fk_related_model_id] = await Model.getWithInfo({
          id: colOpt.fk_related_model_id,
        });
        if (colOpt.type === 'mm') {
          relatedMetas[colOpt.fk_mm_model_id] = await Model.getWithInfo({
            id: colOpt.fk_mm_model_id,
          });
        }
      }
    }

    view.relatedMetas = relatedMetas;

    return view;
  }
  async publicSharedBaseGet(param: { sharedBaseUuid: string }): Promise<any> {
    const project = await Project.getByUuid(param.sharedBaseUuid);

    if (!project) {
      NcError.notFound();
    }

    return { project_id: project.id };
  }
}
