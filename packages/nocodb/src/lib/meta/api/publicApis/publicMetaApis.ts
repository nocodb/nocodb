import { Request, Response, Router } from 'express';
import catchError, { NcError } from '../../helpers/catchError';
import View from '../../../models/View';
import Model from '../../../models/Model';
import {
  ErrorMessages,
  LinkToAnotherRecordType,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import Column from '../../../models/Column';
import Base from '../../../models/Base';
import Project from '../../../models/Project';
import LinkToAnotherRecordColumn from '../../../models/LinkToAnotherRecordColumn';

export async function viewMetaGet(req: Request, res: Response) {
  const view: View & {
    relatedMetas?: { [ket: string]: Model };
    client?: string;
  } = await View.getByUUID(req.params.sharedViewUuid);

  if (!view) NcError.notFound('Not found');

  if (view.password && view.password !== req.headers?.['xc-password']) {
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

  res.json(view);
}
async function publicSharedBaseGet(req, res): Promise<any> {
  const project = await Project.getByUuid(req.params.sharedBaseUuid);

  if (!project) {
    NcError.notFound();
  }

  res.json({ project_id: project.id });
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/meta',
  catchError(viewMetaGet)
);

router.get(
  '/api/v1/db/public/shared-base/:sharedBaseUuid/meta',
  catchError(publicSharedBaseGet)
);
export default router;
