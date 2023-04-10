import { NcError } from './../../meta/helpers/catchError';
import { ViewTypes } from 'nocodb-sdk';
import { Project, Base, Model } from '../../models';
import { dataService } from '..';
import { getViewAndModelByAliasOrId } from '../dbData/helpers';

/*
  {
    "entity": "project",
    "bases": [
      ### current scope
      {
        "entity": "base",
        "models": [
          {
            "entity": "model",
            "model": {},
            "views": []
          }
        ]
      }
      ### end current scope
    ]
  }
*/

async function serializeModels(param: { modelId: string[] }) {
  const serializedModels = [];

  // db id to structured id
  const idMap = new Map<string, string>();

  const projects: Project[] = []
  const bases: Base[] = []
  const modelsMap = new Map<string, Model[]>();

  for (const modelId of param.modelId) {
    const model = await Model.get(modelId);

    if (!model) return NcError.badRequest(`Model not found for id '${modelId}'`);

    const fndProject = projects.find(p => p.id === model.project_id)
    const project = fndProject || await Project.get(model.project_id);

    const fndBase = bases.find(b => b.id === model.base_id)
    const base = fndBase || await Base.get(model.base_id);

    if (!fndProject) projects.push(project);
    if (!fndBase) bases.push(base);

    if (!modelsMap.has(base.id)) {
      const all_models = await base.getModels();

      for (const md of all_models) {
        idMap.set(md.id, `${project.id}::${base.id}::${md.id}`);
        await md.getColumns();
        for (const column of md.columns) {
          idMap.set(column.id, `${idMap.get(md.id)}::${column.id}`);
        }
      }

      modelsMap.set(base.id, all_models);
    }

    idMap.set(project.id, project.id);
    idMap.set(base.id, `${project.id}::${base.id}`);
    idMap.set(model.id, `${idMap.get(base.id)}::${model.id}`);

    await model.getColumns();
    await model.getViews();

    for (const column of model.columns) {
      idMap.set(
        column.id,
        `${idMap.get(model.id)}::${column.id}`
      );
      await column.getColOptions();
      if (column.colOptions) {
        for (const [k, v] of Object.entries(column.colOptions)) {
          switch (k) {
            case 'fk_mm_child_column_id':
            case 'fk_mm_parent_column_id':
            case 'fk_mm_model_id':
            case 'fk_parent_column_id':
            case 'fk_child_column_id':
            case 'fk_related_model_id':
            case 'fk_relation_column_id':
            case 'fk_lookup_column_id':
            case 'fk_rollup_column_id':
              column.colOptions[k] = idMap.get(v as string);
              break;
            case 'options':
              for (const o of column.colOptions['options']) {
                delete o.id;
                delete o.fk_column_id;
              }
              break;
            case 'formula':
              column.colOptions[k] = column.colOptions[k].replace(/(?<=\{\{).*?(?=\}\})/gm, (match) => idMap.get(match));
              break;
            case 'id':
            case 'created_at':
            case 'updated_at':
            case 'fk_column_id':
              delete column.colOptions[k];
              break;
          }
        }
      }
    }

    for (const view of model.views) {
      idMap.set(view.id, `${idMap.get(model.id)}::${view.id}`);
      await view.getColumns();
      await view.getFilters();
      await view.getSorts();
      if (view.filter) {
        const export_filters = []
        for (const fl of view.filter.children) {
          const tempFl = {
            id: `${idMap.get(view.id)}::${fl.id}`,
            fk_column_id: idMap.get(fl.fk_column_id),
            fk_parent_id: fl.fk_parent_id,
            is_group: fl.is_group,
            logical_op: fl.logical_op,
            comparison_op: fl.comparison_op,
            comparison_sub_op: fl.comparison_sub_op,
            value: fl.value,
          }
          if (tempFl.is_group) {
            delete tempFl.comparison_op;
            delete tempFl.comparison_sub_op;
            delete tempFl.value;
          }
          export_filters.push(tempFl)
        }
        view.filter.children = export_filters;
      }

      if (view.sorts) {
        const export_sorts = []
        for (const sr of view.sorts) {
          const tempSr = {
            fk_column_id: idMap.get(sr.fk_column_id),
            direction: sr.direction,
          }
          export_sorts.push(tempSr)
        }
        view.sorts = export_sorts;
      }

      if (view.view) {
        for (const [k, v] of Object.entries(view.view)) {
          switch (k) {
            case 'fk_column_id':
            case 'fk_cover_image_col_id':
            case 'fk_grp_col_id':
              view.view[k] = idMap.get(v as string);
              break;
            case 'meta':
              if (view.type === ViewTypes.KANBAN) {
                const meta = JSON.parse(view.view.meta as string) as Record<string, any>;
                for (const [k, v] of Object.entries(meta)) {
                  const colId = idMap.get(k as string);
                  for (const op of v) {
                    op.fk_column_id = idMap.get(op.fk_column_id);
                    delete op.id;
                  }
                  meta[colId] = v;
                  delete meta[k];
                }
                view.view.meta = meta;
              }
              break;
            case 'created_at':
            case 'updated_at':
            case 'fk_view_id':
            case 'project_id':
            case 'base_id':
            case 'uuid':
              delete view.view[k];
              break;
          }
        }
      }
    }

    serializedModels.push({
      entity: 'model',
      model: {
        id: idMap.get(model.id),
        prefix: project.prefix,
        title: model.title,
        table_name: clearPrefix(model.table_name, project.prefix),
        meta: model.meta,
        columns: model.columns.map((column) => ({
          id: idMap.get(column.id),
          ai: column.ai,
          column_name: column.column_name,
          cc: column.cc,
          cdf: column.cdf,
          meta: column.meta,
          pk: column.pk,
          order: column.order,
          rqd: column.rqd,
          system: column.system,
          uidt: column.uidt,
          title: column.title,
          un: column.un,
          unique: column.unique,
          colOptions: column.colOptions,
        })),
      },
      views: model.views.map((view) => ({
        id: idMap.get(view.id),
        is_default: view.is_default,
        type: view.type,
        meta: view.meta,
        order: view.order,
        title: view.title,
        show: view.show,
        show_system_fields: view.show_system_fields,
        filter: view.filter,
        sorts: view.sorts,
        lock_type: view.lock_type,
        columns: view.columns.map((column) => {
          const {
            id,
            fk_view_id,
            fk_column_id,
            project_id,
            base_id,
            created_at,
            updated_at,
            uuid,
            ...rest
          } = column as any;
          return {
            fk_column_id: idMap.get(fk_column_id),
            ...rest,
          };
        }),
        view: view.view,
      })),
    });
  }

  return serializedModels;
}

export async function exportBaseSchema(param: { baseId: string }) {
  const base = await Base.get(param.baseId);

  if (!base) return NcError.badRequest(`Base not found for id '${param.baseId}'`);

  const project = await Project.get(base.project_id);

  const models = (await base.getModels()).filter((m) => !m.mm);

  const exportedModels = await serializeModels({ modelId: models.map(m => m.id) });

  const exportData = { id: `${project.id}::${base.id}`, entity: 'base', models: exportedModels };

  return exportData;
}

const clearPrefix = (text: string, prefix?: string) => {
  if (!prefix || prefix.length === 0) return text;
  return text.replace(new RegExp(`^${prefix}_?`), '');
}
