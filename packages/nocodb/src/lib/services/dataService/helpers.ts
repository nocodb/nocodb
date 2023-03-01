import { NcError } from '../../meta/helpers/catchError'
import { Model, View } from '../../models'
import Project from '../../models/Project'


export interface PathParams {
  projectName: string;
  tableName: string;
  viewName?: string;
}

export async function getViewAndModelByAliasOrId(param: {
  projectName: string;
  tableName: string;
  viewName?: string;
}) {
  const project = await Project.getWithInfoByTitleOrId(param.projectName);

  const model = await Model.getByAliasOrId({
    project_id: project.id,
    aliasOrId: param.tableName,
  });
  const view =
    param.viewName &&
    (await View.getByTitleOrId({
      titleOrId: param.viewName,
      fk_model_id: model.id,
    }));
  if (!model) NcError.notFound('Table not found');
  return { model, view };
}
