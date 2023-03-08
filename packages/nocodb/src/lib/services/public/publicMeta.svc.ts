import type { LinkToAnotherRecordType } from 'nocodb-sdk';
import { ErrorMessages, RelationTypes, UITypes } from 'nocodb-sdk';
import { NcError } from '../../meta/helpers/catchError';
import type { LinkToAnotherRecordColumn } from '../../models';
import { Base, Column, Model, Project, View } from '../../models';

export async function viewMetaGet(param: {
  sharedViewUuid: string;
  password: string;
}) {
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
              c.fk_column_id
        )
      );
    })
    .map(
      (c) =>
        new Column({ ...c, ...view.model.columnsById[c.fk_column_id] } as any)
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
export async function publicSharedBaseGet(param: {
  sharedBaseUuid: string;
}): Promise<any> {
  const project = await Project.getByUuid(param.sharedBaseUuid);

  if (!project) {
    NcError.notFound();
  }

  return { project_id: project.id };
}

export async function publicSharedErdGet(param: {
  sharedErdUuid: string;
}): Promise<any> {
  const base = await Base.getByUUID(param.sharedErdUuid);

  if (!base) {
    NcError.notFound();
  }

  return base;
}

export async function getPublicProject(param: { id: string }): Promise<any> {
  const project = await Project.get(param.id);
  if (!project) {
    NcError.notFound();
  }

  if (project.type !== 'documentation') {
    NcError.forbidden('Not allowed');
  }

  const projectMeta = project?.meta
    ? typeof project.meta === 'string'
      ? JSON.parse(project.meta as string)
      : project.meta
    : {};

  return { title: project.title, id: project.id, meta: projectMeta };
}
