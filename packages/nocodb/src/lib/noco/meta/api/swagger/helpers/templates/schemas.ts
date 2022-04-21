export default (ctx: {
  tableName: string;
  orgs: string;
  projectName: string;
  columns: Array<{
    type: any;
    title: string;
    description?: string;
    virtual?: boolean;
  }>;
}) => ({
  [`${ctx.tableName}Response`]: {
    title: `${ctx.tableName} Response`,
    type: 'object',
    description: '',
    'x-internal': false,
    properties: {
      ...(ctx.columns?.reduce(
        (colsObj, { title, virtual, ...fieldProps }) => ({
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
        (colsObj, { title, virtual, ...fieldProps }) => ({
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
