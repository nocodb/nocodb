import type { SwaggerColumn } from '../getSwaggerColumnMetas';

export const getModelSchemas = (ctx: {
  tableName: string;
  orgs: string;
  baseName: string;
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
          [title]: fieldProps,
        }),
        {},
      ) || {}),
    },
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
                [title]: fieldProps,
              }),
        }),
        {},
      ) || {}),
    },
  },
});
export const getViewSchemas = (ctx: {
  tableName: string;
  viewName: string;
  orgs: string;
  baseName: string;
  columns: Array<SwaggerColumn>;
}) => ({
  [`${ctx.tableName}${ctx.viewName}GridResponse`]: {
    title: `${ctx.tableName} : ${ctx.viewName} Response`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      ...(ctx.columns?.reduce(
        (colsObj, { title, virtual, column, ...fieldProps }) => ({
          ...colsObj,
          [title]: fieldProps,
        }),
        {},
      ) || {}),
    },
  },
  [`${ctx.tableName}${ctx.viewName}GridRequest`]: {
    title: `${ctx.tableName} : ${ctx.viewName} Request`,
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
                [title]: fieldProps,
              }),
        }),
        {},
      ) || {}),
    },
  },
});
