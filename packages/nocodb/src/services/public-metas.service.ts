import { Injectable } from '@nestjs/common';
import { ErrorMessages, RelationTypes, UITypes } from 'nocodb-sdk';
import { NcError } from '../helpers/catchError';
import { Base, Column, Model, Project, View } from '../models';
import type { LinkToAnotherRecordColumn, LookupColumn } from '../models';
import type { LinkToAnotherRecordType } from 'nocodb-sdk';

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
      } else if (UITypes.Lookup === col.uidt) {
        await this.extractLookupRelatedMetas({
          lookupColOption: await col.getColOptions<LookupColumn>(),
          relatedMetas,
        });
      }
    }

    view.relatedMetas = relatedMetas;

    return view;
  }

  private async extractLookupRelatedMetas({
    lookupColOption,
    relatedMetas = {},
  }: {
    lookupColOption: LookupColumn;
    relatedMetas: { [key: string]: Model };
  }) {
    const relationCol = await Column.get({
      colId: lookupColOption.fk_relation_column_id,
    });
    const lookupCol = await Column.get({
      colId: lookupColOption.fk_lookup_column_id,
    });

    // extract meta for table which belongs the relation column
    // if not already extracted
    if (!relatedMetas[relationCol.fk_model_id]) {
      relatedMetas[relationCol.fk_model_id] = await Model.getWithInfo({
        id: lookupCol.fk_model_id,
      });
    }
    // extract meta for table in which looked up column belongs
    // if not already extracted
    if (!relatedMetas[lookupCol.fk_model_id]) {
      relatedMetas[lookupCol.fk_model_id] = await Model.getWithInfo({
        id: lookupCol.fk_model_id,
      });
    }

    // if looked up column is a lookup column do the same for it by recursion
    if (lookupCol.uidt === UITypes.Lookup) {
      await this.extractLookupRelatedMetas({
        lookupColOption: await lookupCol.getColOptions<LookupColumn>(),
        relatedMetas,
      });
    }
  }

  async publicSharedBaseGet(param: { sharedBaseUuid: string }): Promise<any> {
    const project = await Project.getByUuid(param.sharedBaseUuid);

    if (!project) {
      NcError.notFound();
    }

    return { project_id: project.id };
  }
}
