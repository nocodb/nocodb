import Noco from '../../../../Noco';
import Model from '../../../../../noco-models/Model';
import Project from '../../../../../noco-models/Project';
import schemas from './templates/schemas';
import SwaggerTypes from '../../../../../sqlMgr/code/routers/xc-ts/SwaggerTypes';
import { UITypes } from 'nocodb-sdk';
import LinkToAnotherRecordColumn from '../../../../../noco-models/LinkToAnotherRecordColumn';

export default async function getSchemas(
  project: Project,
  model: Model,
  ncMeta = Noco.ncMeta
) {
  const dbType = await project.getBases().then(b => b?.[0]?.type);
  const columns = await model.getColumns(ncMeta).then(cols => {
    return Promise.all(
      cols.map(async c => {
        const field: {
          title: string;
          type: any;
          $ref?: any;
          virtual?: boolean;
        } = {
          title: c.title,
          type: 'object',
          virtual: true
        };

        switch (c.uidt) {
          case UITypes.LinkToAnotherRecord:
            {
              const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>(
                ncMeta
              );
              const relTable = await colOpt.getRelatedTable(ncMeta);
              field.type = undefined;
              field.$ref = `#/components/schemas/${relTable.title}Request`;
            }
            break;
          case UITypes.Formula:
          case UITypes.Lookup:
            field.type = 'object';
            break;
          case UITypes.Rollup:
            field.type = 'number';
            break;
          default:
            field.virtual = false;
            SwaggerTypes.setSwaggerType(c, field, dbType);
            break;
        }

        return field;
      })
    );
  });
  return schemas({
    tableName: model.title,
    orgs: 'noco',
    projectName: project.title,
    columns
  });
}
