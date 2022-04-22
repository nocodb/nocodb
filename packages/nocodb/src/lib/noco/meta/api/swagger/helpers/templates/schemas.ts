import { SwaggerColumn } from '../getSwaggerColumnMetas';

export default (ctx: {
  tableName: string;
  orgs: string;
  projectName: string;
  columns: Array<SwaggerColumn>;
}) => ({
  [`${ctx.tableName}Response`]: {
    title: `${ctx.tableName} Response`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      ...(ctx.columns?.reduce(
        (colsObj, { title, virtual, column, ...fieldProps }) => ({
          ...colsObj,
          [title]: fieldProps
        }),
        {}
      ) || {})
    }
  },
  [`${ctx.tableName}Request`]: {
    title: `${ctx.tableName} Request`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      ...(ctx.columns?.reduce(
        (colsObj, { title, virtual, column, ...fieldProps }) => ({
          ...colsObj,
          ...(virtual
            ? {}
            : {
                [title]: fieldProps
              })
        }),
        {}
      ) || {})
    }
  }
});
